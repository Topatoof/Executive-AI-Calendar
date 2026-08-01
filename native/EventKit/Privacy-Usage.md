# EventKit privacy usage keys

Add these keys to your app target’s **Info.plist** (or the Xcode target’s Privacy — Calendar usage descriptions). Without them, permission requests fail at runtime.

## Required (iOS 17+ / macOS 14+)

| Key | Example value |
| --- | --- |
| `NSCalendarsFullAccessUsageDescription` | `Exec AI needs full calendar access to read and update your schedule.` |

XML:

```xml
<key>NSCalendarsFullAccessUsageDescription</key>
<string>Exec AI needs full calendar access to read and update your schedule.</string>
```

## Legacy (iOS 16 / macOS 13 and earlier)

| Key | Example value |
| --- | --- |
| `NSCalendarsUsageDescription` | `Exec AI needs calendar access to manage your events.` |

XML:

```xml
<key>NSCalendarsUsageDescription</key>
<string>Exec AI needs calendar access to manage your events.</string>
```

If you only need **write** access on newer OS versions, you may instead use `NSCalendarsWriteOnlyAccessUsageDescription` with `requestWriteOnlyAccessToEvents()`. This helper requests **full** access so it can both read and modify events.

## Setup checklist

1. Add this folder as a local Swift package (`Package.swift` → product `ExecAIEventKit`) **or** copy the `.swift` sources and link **EventKit**.
2. Add the privacy keys above.
3. `import ExecAIEventKit` (package) or use the types directly if sources are in the app target.
4. Call `await CalendarEventStore().requestAccess()` before read/write APIs.
5. On device: Settings → Privacy & Security → Calendars → allow your app if the user previously denied.

## Files

- `Package.swift` — local Swift package definition
- `CalendarEventStore.swift` — request access; fetch, create, update, delete events
- `ExampleUsage.swift` — sample async flow and optional SwiftUI button
- `README.md` — add-to-Xcode quick start
