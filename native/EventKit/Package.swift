// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "ExecAIEventKit",
  platforms: [
    .iOS(.v16),
    .macOS(.v13),
  ],
  products: [
    .library(name: "ExecAIEventKit", targets: ["ExecAIEventKit"]),
  ],
  targets: [
    .target(
      name: "ExecAIEventKit",
      path: ".",
      exclude: [
        "Privacy-Usage.md",
        "README.md",
        "Package.swift",
      ],
      linkerSettings: [
        .linkedFramework("EventKit"),
      ]
    ),
  ]
)
