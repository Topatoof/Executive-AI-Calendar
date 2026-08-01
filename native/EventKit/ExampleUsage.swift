import EventKit
import Foundation

/// Example call sites for ``CalendarEventStore``.
/// Copy into a SwiftUI view, `AppDelegate`, or playground after linking EventKit
/// and adding the privacy keys from `Privacy-Usage.md`.
public enum CalendarEventStoreExample {
  public static func runDemo() async {
    let calendarStore = CalendarEventStore()

    do {
      // 1. Request permission (shows the system dialog on first launch).
      try await calendarStore.requestAccess()
      print("Authorization:", calendarStore.authorizationStatus().rawValue)

      // 2. Read events for the next 7 days.
      let now = Date()
      let weekLater = Calendar.current.date(byAdding: .day, value: 7, to: now)!
      let upcoming = try await calendarStore.fetchEvents(from: now, to: weekLater)
      print("Upcoming events:", upcoming.count)
      for event in upcoming.prefix(5) {
        print("- \(event.title) @ \(event.startDate)")
      }

      // 3. Create a new event.
      let start = Calendar.current.date(byAdding: .hour, value: 1, to: now)!
      let end = Calendar.current.date(byAdding: .hour, value: 2, to: start)!
      var created = try await calendarStore.createEvent(
        CalendarEventDraft(
          title: "Focus block",
          startDate: start,
          endDate: end,
          notes: "Created via CalendarEventStore",
          location: nil,
          isAllDay: false
        )
      )
      print("Created:", created.eventIdentifier ?? "(no id)", created.title)

      // 4. Modify the event we just created.
      guard created.eventIdentifier != nil else { return }
      created.title = "Focus block (updated)"
      created.notes = "Rescheduled title via CalendarEventStore"
      let updated = try await calendarStore.updateEvent(created, span: .thisEvent)
      print("Updated:", updated.title)

      // Optional: delete when done experimenting.
      // if let id = updated.eventIdentifier {
      //   try await calendarStore.deleteEvent(identifier: id)
      // }
    } catch {
      print("CalendarEventStore error:", error.localizedDescription)
    }
  }
}

#if canImport(SwiftUI)
import SwiftUI

/// Minimal SwiftUI button that runs the demo after the user taps.
public struct CalendarAccessDemoButton: View {
  @State private var statusText = "Tap to request access and sync a sample event"

  public init() {}

  public var body: some View {
    Button(statusText) {
      Task {
        await CalendarEventStoreExample.runDemo()
        statusText = "Done — check console / Calendar app"
      }
    }
  }
}
#endif
