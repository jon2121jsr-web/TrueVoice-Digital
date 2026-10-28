// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NativeAudioPolicy",
    products: [.library(name: "NativeAudioPolicy", targets: ["NativeAudioPolicy"])],
    targets: [
        .target(name: "NativeAudioPolicy"),
        .testTarget(name: "NativeAudioPolicyTests", dependencies: ["NativeAudioPolicy"])
    ]
)
