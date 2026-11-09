// MEMAR — pending-count badge that floats above one stand-in object.
// Lives on "Badge-<id>", a child of "Object-<id>" created by MemoraStandIn.
//
// Owns: a round UIKit BackPlate dot + the count label, and its own visibility.
// Generic over objectId: MemoraStandIn creates one per object ("Badge-<id>").
// Style (size, colours) comes from THEME in MemoraThemeUI.ts.
// Expects: nothing wired; MemoraMain pushes the count with setCount().
// Must NOT: read the memory store. It is a passive view.

import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {makeFlex, makeObject, makePlate, makeText, THEME} from "./MemoraThemeUI"

/** Frames to wait before hiding anything, so UIKit components finish OnStart + first layout. */
const WARMUP_FRAMES = 3

@component
export class MemoraBadgeUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MemoraBadgeUI – pending count above a stand-in</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Object id this badge counts (an id from MEMORA_OBJECTS). Set by MemoraStandIn; MemoraMain pushes the count.")
  objectId: string = ""

  @input
  @hint("Turn the badge to face the user as they move")
  faceUser: boolean = true
  @ui.group_end

  private countText: Text | undefined
  private count = 0
  private frames = 0
  private ready = false

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const d = THEME.badge.diameterCm
    makePlate(this.sceneObject, new vec2(d, d), THEME.badge.dot, d / 2)

    const content = makeObject(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    const col = makeFlex(content, "CountColumn", FlexDirection.Column, d, d, false, {
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })
    this.countText = makeText(col, "Count", String(this.count), "HeadlineXL", d / 3.2, d, d)

    if (this.faceUser) this.sceneObject.createComponent(Billboard.getTypeName())

    const warm = this.createEvent("UpdateEvent")
    warm.bind(() => {
      this.frames++
      if (this.frames < WARMUP_FRAMES) return
      warm.enabled = false
      this.ready = true
      this.applyVisibility()
    })
  }

  /** Show the pending count; the badge hides itself at 0 (with a short pulse / pop / shrink). */
  setCount(n: number): void {
    const before = this.count
    this.count = Math.max(0, Math.floor(n))
    if (this.count > 0 && this.countText) this.countText.text = this.count > 9 ? "9+" : String(this.count)
    if (!this.ready) return
    if (this.count === before) {
      this.applyVisibility()
      return
    }
    if (this.count === 0) this.animateScale(1, 0, 0.2, "ease-in-quad", () => this.applyVisibility())
    else if (before === 0) {
      this.applyVisibility()
      this.animateScale(0.6, 1, 0.22, "ease-out-back")
    } else this.pulse()
  }

  private cancelAnim: CancelFunction | undefined

  private animateScale(from: number, to: number, seconds: number, easing: "ease-in-quad" | "ease-out-back", done?: () => void): void {
    if (this.cancelAnim) this.cancelAnim()
    const t = this.sceneObject.getTransform()
    t.setLocalScale(new vec3(from, from, from))
    this.cancelAnim = animate({
      duration: seconds,
      easing,
      update: (k: number) => {
        const s = from + (to - from) * k
        t.setLocalScale(new vec3(s, s, s))
      },
      ended: () => {
        t.setLocalScale(vec3.one())
        if (done) done()
      },
    })
  }

  /** Count changed but still shown: a quick swell so the change is noticed. */
  private pulse(): void {
    if (this.cancelAnim) this.cancelAnim()
    const t = this.sceneObject.getTransform()
    this.cancelAnim = animate({
      duration: 0.32,
      easing: "linear",
      update: (k: number) => {
        const s = 1 + 0.3 * Math.sin(Math.PI * k)
        t.setLocalScale(new vec3(s, s, s))
      },
      ended: () => t.setLocalScale(vec3.one()),
    })
  }

  getCount(): number {
    return this.count
  }

  /** True when the badge is drawn (count > 0). */
  isShown(): boolean {
    return this.sceneObject.enabled && this.count > 0
  }

  private applyVisibility(): void {
    this.sceneObject.enabled = this.count > 0
  }
}
