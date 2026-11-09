// Compatibility typings for the Lens Studio-managed AiPreviewAgentInspect.lspkg package.
//
// Its two Example scripts (Example/GuideDismissPanel, Example/ExampleCarousel) import
// "UIKit.lspkg/..." and "InteractionKit.lspkg/..." (the 4.0 package names). This project
// uses SpectaclesUIKit / SpectaclesInteractionKit 2.0, so those imports fail to resolve
// (TS2307) and the failed compile stops Lens Studio from generating @input descriptors
// for every other script in the project.
//
// The examples are never attached to a SceneObject, so they never run; these loose
// declarations only let the type check pass. Delete this file if the package is
// updated or removed.

declare module "UIKit.lspkg/Scripts/Components/Button/Button" {
  export type Button = any
  export const Button: any
}

declare module "UIKit.lspkg/Scripts/Components/Button/RectangleButton" {
  export type RectangleButton = any
  export const RectangleButton: any
}

declare module "UIKit.lspkg/Scripts/Components/Frame/Frame" {
  export type Frame = any
  export const Frame: any
}

declare module "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider" {
  type WorldCameraFinderProvider = any
  const WorldCameraFinderProvider: any
  export default WorldCameraFinderProvider
}
