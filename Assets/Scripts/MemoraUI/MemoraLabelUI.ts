// MEMAR — a small world-space pill label (zone labels, zone hints, the first-run
// hint, scan tags). Created at runtime by other MEMAR scripts and configured with
// configure(); no @inputs (runtime-created components don't get reliable defaults).
//
// Owns: a UIKit BackPlate + one centred line of text laid out by a FlexLayout row,
// and its own visibility.
// Must NOT: read the store. Callers push text in.

import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {makeFlex, makeObject, makePlate, makeText, TextRole, THEME} from "./MemoraThemeUI"

export type LabelStyle = {plate: vec4; text: vec4; role: TextRole; scale?: number}

/** Frames to wait before hiding, so UIKit components finish OnStart + first layout. */
const WARMUP_FRAMES = 3

@component
export class MemoraLabelUI extends BaseScriptComponent {
  private label: Text | undefined
  private wantVisible = true
  private ready = false

  onAwake(): void {
    let frames = 0
    const warm = this.createEvent("UpdateEvent")
    warm.bind(() => {
      frames++
      if (frames < WARMUP_FRAMES) return
      warm.enabled = false
      this.ready = true
      this.sceneObject.enabled = this.wantVisible
    })
  }

  /** Builds the pill. Call once, right after createComponent. */
  configure(text: string, widthCm: number, heightCm: number, style: LabelStyle): void {
    if (this.label) return
    this.sceneObject.createComponent("Component.Canvas")
    makePlate(this.sceneObject, new vec2(widthCm, heightCm), style.plate, Math.min(heightCm / 2, THEME.radiusCm * 2))
    const content = makeObject(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    const row = makeFlex(content, "LabelRow", FlexDirection.Row, widthCm, heightCm, false, {
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })
    this.label = makeText(row, "LabelText", text, style.role, style.scale ?? 1, widthCm - 1, heightCm - 0.4, {color: style.text})
  }

  setText(text: string): void {
    if (this.label) this.label.text = text
  }

  getText(): string {
    return this.label ? this.label.text : ""
  }

  setVisible(visible: boolean): void {
    this.wantVisible = visible
    if (this.ready) this.sceneObject.enabled = visible
  }

  isShown(): boolean {
    return this.ready ? this.sceneObject.enabled : this.wantVisible
  }
}

/** Creates `<name>` under `parent` at `localPos` with a configured label. */
export function createLabel(
  parent: SceneObject,
  name: string,
  localPos: vec3,
  text: string,
  widthCm: number,
  heightCm: number,
  style: LabelStyle,
): MemoraLabelUI {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  so.getTransform().setLocalPosition(localPos)
  const label = so.createComponent(MemoraLabelUI.getTypeName()) as MemoraLabelUI
  label.configure(text, widthCm, heightCm, style)
  return label
}
