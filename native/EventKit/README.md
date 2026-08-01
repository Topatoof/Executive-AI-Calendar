# ExecAI EventKit

Swift helper around Apple’s `EKEventStore` for requesting calendar permission and reading, creating, updating, or deleting events.

## Add to an Xcode project

**Option A — Swift Package (local)**  
File → Add Package Dependencies → Add Local → select this `EventKit` folder → link `ExecAIEventKit`.

**Option B — Copy sources**  
Add `CalendarEventStore.swift` (and optionally `ExampleUsage.swift`) to your app target and link the **EventKit** framework.

Then add the Info.plist keys in [Privacy-Usage.md](Privacy-Usage.md).

## Quick start

```swift
import ExecAIEventKit

let store = CalendarEventStore()
try await store.requestAccess()

let start = Date()
let end = Calendar.current.date(byAdding: .day, value: 7, to: start)!
let events = try await store.fetchEvents(from: start, to: end)

let created = try await store.createEvent(
  CalendarEventDraft(
    title: "Deep work",
    startDate: start,
    endDate: Calendar.current.date(byAdding: .hour, value: 1, to: start)!
  )
)

var draft = created
draft.title = "Deep work (moved)"
_ = try await store.updateEvent(draft)
```

See `ExampleUsage.swift` for a full demo flow.

## Note

This module does not talk to the Next.js Exec AI web app. EventKit only runs on Apple platforms.
