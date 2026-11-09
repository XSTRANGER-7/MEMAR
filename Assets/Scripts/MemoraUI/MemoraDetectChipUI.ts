// MEMAR — the chip that appears above an object once look-to-detect locks on it:
// "Detected" / "Keys · 1 memory — pinch to open". The whole chip is one UIKit
// Button on the SceneObject "DetectChip" (child of "DetectChipRoot", so LEAF can
// pinch it by name).
// Created at runtime by MemoraDetection and configured with configure().
//
// Owns: the chip surface, its two text lines, its visibility.
// Must NOT: decide what a pinch does; it raises onPressed and MemoraDetection
// selects the object.

import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {applyTint, lighten, makeButton, makeFlex, makeObject, makePlate, makeText, THEME, tintFrom} from "./MemoraThemeUI"

const WARMUP_FRAMES = 3

@component
export class MemoraDetectChipUI extends BaseScriptComponent {
  private _onPressed = new Event<void>()
  get onPressed(): PublicApi<void> {
    return this._onPressed.publicApi()
  }

  private button: Button | undefined
  private main: Text | undefined
  private wantVisible = false
  private ready = false

  onAwake(): void {
    let frames = 0
    const warm = this.createEvent("UpdateEvent")
    warm.bind(() => {
      frames++
      if (frames < WARMUP_FRAMES) return
      warm.enabled = false
      this.ready = true
      if (this.button) applyTint(this.button, tintFrom(THEME.detect.chip))
      this.sceneObject.enabled = this.wantVisible
    })
  }

  /** Builds the chip. Call once, right after createComponent. */
  configure(): void {
    if (this.button) return
    const C = THEME.detect
    this.sceneObject.createComponent("Component.Canvas")
    // A thin rim behind the chip. Solid, so the chip is one panel: a hand or gaze ray
    // that meets the chip's edge counts as meeting the chip, not something "in front" of it.
    makePlate(this.sceneObject, new vec2(C.chipWidthCm + 0.6, C.chipHeightCm + 0.6), lighten(C.chip, 0.1), THEME.radiusCm * 1.3, true)
    const face = makeObject(this.sceneObject, "ChipFace", new vec3(0, 0, 0.5))
    // The Button's SceneObject is named "DetectChip" so a pinch on that name hits it.
    this.button = makeButton(face, "DetectChip", C.chipWidthCm, C.chipHeightCm)
    this.button.onTriggerUp.add(() => this._onPressed.invoke())
    const col = makeFlex(this.button.sceneObject, "ChipText", FlexDirection.Column, C.chipWidthCm - 1.6, C.chipHeightCm - 0.6, false, {
      gap: 0.1,
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })
    col.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    makeText(col, "ChipCaption", "Detected", "Caption", 1, C.chipWidthCm - 1.6, 1.4, {color: C.caption})
    this.main = makeText(col, "ChipText", "", "Subheadline", 1.05, C.chipWidthCm - 1.6, 2.4)
  }

  /** The SceneObject that holds the pinchable Button. */
  getButtonObject(): SceneObject | undefined {
    return this.button ? this.button.sceneObject : undefined
  }

  setText(text: string): void {
    if (this.main) this.main.text = text
  }

  getText(): string {
    return this.main ? this.main.text : ""
  }

  setVisible(visible: boolean): void {
    const appearing = visible && !this.isShown()
    this.wantVisible = visible
    if (this.ready) this.sceneObject.enabled = visible
    if (appearing && this.ready) this.popIn()
  }

  /** Soft scale-in so the chip appears instead of blinking on. */
  private popIn(): void {
    if (this.cancelPop) this.cancelPop()
    const t = this.sceneObject.getTransform()
    t.setLocalScale(new vec3(0.85, 0.85, 0.85))
    this.cancelPop = animate({
      duration: 0.18,
      easing: "ease-out-quad",
      update: (k: number) => {
        const s = 0.85 + 0.15 * k
        t.setLocalScale(new vec3(s, s, s))
      },
    })
  }

  private cancelPop: CancelFunction | undefined

  isShown(): boolean {
    return this.ready ? this.sceneObject.enabled : this.wantVisible
  }
}
