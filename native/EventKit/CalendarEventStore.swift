import EventKit
import Foundation

/// Errors thrown by ``CalendarEventStore``.
enum CalendarStoreError: LocalizedError {
  case accessDenied
  case accessRestricted
  case eventNotFound(identifier: String)
  case noWritableCalendar
  case saveFailed(underlying: Error)
  case removeFailed(underlying: Error)

  var errorDescription: String? {
    switch self {
    case .accessDenied:
      return "Calendar access was denied. Enable it in System Settings / Settings."
    case .accessRestricted:
      return "Calendar access is restricted on this device."
    case .eventNotFound(let identifier):
      return "No event found with identifier \(identifier)."
    case .noWritableCalendar:
      return "No writable calendar is available."
    case .saveFailed(let underlying):
      return "Failed to save event: \(underlying.localizedDescription)"
    case .removeFailed(let underlying):
      return "Failed to remove event: \(underlying.localizedDescription)"
    }
  }
}

/// Lightweight value type for listing or editing events without holding `EKEvent` references.
struct CalendarEventDraft: Sendable, Equatable {
  var eventIdentifier: String?
  var title: String
  var startDate: Date
  var endDate: Date
  var notes: String?
  var location: String?
  var isAllDay: Bool
  var calendarIdentifier: String?

  init(
    eventIdentifier: String? = nil,
    title: String,
    startDate: Date,
    endDate: Date,
    notes: String? = nil,
    location: String? = nil,
    isAllDay: Bool = false,
    calendarIdentifier: String? = nil
  ) {
    self.eventIdentifier = eventIdentifier
    self.title = title
    self.startDate = startDate
    self.endDate = endDate
    self.notes = notes
    self.location = location
    self.isAllDay = isAllDay
    self.calendarIdentifier = calendarIdentifier
  }

  init(event: EKEvent) {
    self.eventIdentifier = event.eventIdentifier
    self.title = event.title ?? ""
    self.startDate = event.startDate
    self.endDate = event.endDate
    self.notes = event.notes
    self.location = event.location
    self.isAllDay = event.isAllDay
    self.calendarIdentifier = event.calendar?.calendarIdentifier
  }
}

/// Thread-safe wrapper around `EKEventStore` for requesting access and
/// reading, creating, or modifying calendar events.
actor CalendarEventStore {
  private let store = EKEventStore()

  // MARK: - Authorization

  /// Current EventKit authorization status for calendar events.
  nonisolated func authorizationStatus() -> EKAuthorizationStatus {
    EKEventStore.authorizationStatus(for: .event)
  }

  /// Whether the app currently has permission to read/write events.
  nonisolated var hasAccess: Bool {
    switch authorizationStatus() {
    case .fullAccess, .authorized:
      return true
    default:
      return false
    }
  }

  /// Requests calendar event access. Uses full-access APIs on iOS 17+ / macOS 14+,
  /// with a fallback to the legacy `requestAccess(to:)` API on older systems.
  @discardableResult
  func requestAccess() async throws -> Bool {
    let status = authorizationStatus()
    switch status {
    case .fullAccess, .authorized:
      return true
    case .denied:
      throw CalendarStoreError.accessDenied
    case .restricted:
      throw CalendarStoreError.accessRestricted
    case .notDetermined, .writeOnly:
      break
    @unknown default:
      break
    }

    let granted: Bool
    if #available(iOS 17.0, macOS 14.0, *) {
      granted = try await store.requestFullAccessToEvents()
    } else {
      granted = try await withCheckedThrowingContinuation { continuation in
        store.requestAccess(to: .event) { success, error in
          if let error {
            continuation.resume(throwing: error)
          } else {
            continuation.resume(returning: success)
          }
        }
      }
    }

    guard granted else {
      throw CalendarStoreError.accessDenied
    }
    return true
  }

  private func ensureAccess() throws {
    guard hasAccess else {
      throw CalendarStoreError.accessDenied
    }
  }

  // MARK: - Calendars

  /// Calendars the user can write events into.
  func writableCalendars() throws -> [EKCalendar] {
    try ensureAccess()
    return store.calendars(for: .event).filter(\.allowsContentModifications)
  }

  /// Default calendar for new events, or the first writable calendar.
  func defaultWritableCalendar() throws -> EKCalendar {
    try ensureAccess()
    if let preferred = store.defaultCalendarForNewEvents,
       preferred.allowsContentModifications
    {
      return preferred
    }
    guard let first = try writableCalendars().first else {
      throw CalendarStoreError.noWritableCalendar
    }
    return first
  }

  // MARK: - Read

  /// Fetches events that intersect `[start, end)`.
  /// - Parameter calendars: Optional subset of calendars; `nil` means all event calendars.
  func fetchEvents(
    from start: Date,
    to end: Date,
    calendars: [EKCalendar]? = nil
  ) throws -> [CalendarEventDraft] {
    try ensureAccess()
    let predicate = store.predicateForEvents(
      withStart: start,
      end: end,
      calendars: calendars
    )
    let events = store.events(matching: predicate)
      .sorted { $0.startDate < $1.startDate }
    return events.map(CalendarEventDraft.init(event:))
  }

  /// Loads a single event by its persistent identifier.
  func event(identifier: String) throws -> CalendarEventDraft {
    try ensureAccess()
    guard let event = store.event(withIdentifier: identifier) else {
      throw CalendarStoreError.eventNotFound(identifier: identifier)
    }
    return CalendarEventDraft(event: event)
  }

  // MARK: - Create

  /// Creates and saves a new calendar event. Returns the saved draft (with identifier).
  @discardableResult
  func createEvent(_ draft: CalendarEventDraft) throws -> CalendarEventDraft {
    try ensureAccess()

    let event = EKEvent(eventStore: store)
    apply(draft, to: event)

    if let calendarId = draft.calendarIdentifier,
       let calendar = store.calendar(withIdentifier: calendarId),
       calendar.allowsContentModifications
    {
      event.calendar = calendar
    } else {
      event.calendar = try defaultWritableCalendar()
    }

    do {
      try store.save(event, span: .thisEvent, commit: true)
    } catch {
      throw CalendarStoreError.saveFailed(underlying: error)
    }

    return CalendarEventDraft(event: event)
  }

  // MARK: - Modify

  /// Updates an existing event identified by `draft.eventIdentifier`.
  /// - Parameter span: Use `.futureEvents` to apply changes to a recurring series from this occurrence forward.
  @discardableResult
  func updateEvent(
    _ draft: CalendarEventDraft,
    span: EKSpan = .thisEvent
  ) throws -> CalendarEventDraft {
    try ensureAccess()

    guard let identifier = draft.eventIdentifier,
          let event = store.event(withIdentifier: identifier)
    else {
      throw CalendarStoreError.eventNotFound(
        identifier: draft.eventIdentifier ?? "(nil)"
      )
    }

    apply(draft, to: event)

    if let calendarId = draft.calendarIdentifier,
       let calendar = store.calendar(withIdentifier: calendarId),
       calendar.allowsContentModifications
    {
      event.calendar = calendar
    }

    do {
      try store.save(event, span: span, commit: true)
    } catch {
      throw CalendarStoreError.saveFailed(underlying: error)
    }

    return CalendarEventDraft(event: event)
  }

  /// Deletes an event by identifier.
  func deleteEvent(
    identifier: String,
    span: EKSpan = .thisEvent
  ) throws {
    try ensureAccess()
    guard let event = store.event(withIdentifier: identifier) else {
      throw CalendarStoreError.eventNotFound(identifier: identifier)
    }
    do {
      try store.remove(event, span: span, commit: true)
    } catch {
      throw CalendarStoreError.removeFailed(underlying: error)
    }
  }

  // MARK: - Helpers

  private func apply(_ draft: CalendarEventDraft, to event: EKEvent) {
    event.title = draft.title
    event.startDate = draft.startDate
    event.endDate = draft.endDate
    event.notes = draft.notes
    event.location = draft.location
    event.isAllDay = draft.isAllDay
  }
}
