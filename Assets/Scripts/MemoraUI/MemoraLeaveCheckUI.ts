// MEMAR — "Before you leave": a small note on the front door listing what the
// carry-along things (keys, bag, wallet, umbrella, bottle) still need, e.g.
// "Keys · Collect the parcel before leaving". Up to THEME.leave.maxLines lines,
// then "+N more"; when nothing is left it reads "All set to leave ✓".
// Created at runtime by MemoraMain on the SceneObject "LeaveCheck" (child of
// "Zone-entryway") and built with configure(). The SceneObject is the note's
// TOP-CENTRE, so it hangs down from just under the door handle and its height
// fits its lines.
//
// Owns: the note surface (decorative plate: it never blocks a pinch or a gaze at
// the door behind it), the header, the line slots, its own layout.
// Must NOT: read the store. MemoraMain pushes the lines in on every store change.

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {clip} from "./MemoraFormat"
import {makeFlex, makeObject, makePlate, makeSlot, makeText, TEXT_SECONDARY, THEME} from "./MemoraThemeUI"

const HEADER = "Before you leave"
const ALL_SET = "All set to leave ✓"

type Line = {item: FlexItem; text: Text}

@component
export class MemoraLeaveCheckUI extends BaseScriptComponent {
  private plate!: BackPlate
  private surface!: SceneObject
  private column!: FlexLayout
  private lines: Line[] = []
  private more!: Line
  private empty!: Line
  private shown: string[] = []
  private moreText = ""
  private built = false

  /** Builds the note. Call once, right after createComponent. */
  configure(): void {
    if (this.built) return
    this.built = true
    const L = THEME.leave
    const inner = L.widthCm - L.padCm * 2
    this.sceneObject.createComponent("Component.Canvas")
    this.surface = makeObject(this.sceneObject, "Surface")
    this.plate = makePlate(this.surface, new vec2(L.widthCm, 10), L.plate, THEME.radiusCm * 1.5)
    const content = makeObject(this.surface, "Content", new vec3(0, 0, 0.6))
    // No row gap: each line slot carries its own spacing, so collapsed (0 cm) slots add nothing.
    const columnSo = makeFlex(content, "LeaveColumn", FlexDirection.Column, L.widthCm, 10, false, {
      padX: L.padCm,
      padY: L.padCm,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    this.column = columnSo.getComponent(FlexLayout.getTypeName()) as FlexLayout
    makeText(columnSo, "LeaveHeader", HEADER, "Headline1", L.textScale, inner, L.headerCm, {
      align: HorizontalAlignment.Left,
    })
    for (let i = 0; i < L.maxLines; i++) this.lines.push(this.line(columnSo, `LeaveLine${i}`, inner, THEME.text.primary))
    this.more = this.line(columnSo, "LeaveMore", inner, TEXT_SECONDARY)
    this.empty = this.line(columnSo, "LeaveAllSet", inner, L.success)
    this.render()
  }

  /** "Name · first pending title" per carry-along thing; [] = all set. */
  setItems(items: {objectName: string; firstTitle: string}[]): void {
    const L = THEME.leave
    this.shown = items.slice(0, L.maxLines).map((i) => clip(`${i.objectName} · ${i.firstTitle}`, L.maxChars))
    this.moreText = items.length > L.maxLines ? `+${items.length - L.maxLines} more` : ""
    if (this.built) this.render()
  }

  /** Every visible line, header first (test helper and LEAF hook). */
  getLines(): string[] {
    const out = [HEADER]
    for (const s of this.shown) out.push(s)
    if (this.moreText) out.push(this.moreText)
    if (this.shown.length === 0) out.push(ALL_SET)
    return out
  }

  getHeightCm(): number {
    return this.column ? this.column.height : 0
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private line(column: SceneObject, name: string, inner: number, color: vec4): Line {
    const L = THEME.leave
    const slot = makeSlot(column, name, inner, L.lineCm)
    const text = makeText(slot, `${name}Text`, "", "Subheadline", L.textScale, inner, L.lineCm, {
      align: HorizontalAlignment.Left,
      color,
      asItem: false,
    })
    return {item: slot.getComponent(FlexItem.getTypeName()) as FlexItem, text}
  }

  private render(): void {
    const L = THEME.leave
    let rows = 0
    for (let i = 0; i < this.lines.length; i++) {
      const value = this.shown[i]
      rows += this.setLine(this.lines[i], value ?? "")
    }
    rows += this.setLine(this.more, this.moreText)
    rows += this.setLine(this.empty, this.shown.length === 0 ? ALL_SET : "")
    const h = L.padCm * 2 + L.headerCm + rows * L.lineCm
    this.column.height = h
    this.plate.size = new vec2(L.widthCm, h)
    // Top-centre anchor: the note hangs down from the SceneObject's position.
    this.surface.getTransform().setLocalPosition(new vec3(0, -h / 2, 0))
  }

  /** Shows a line (1) or collapses its slot to zero height (0). */
  private setLine(line: Line, value: string): number {
    line.text.text = value
    line.text.getSceneObject().enabled = value.length > 0
    line.item.overrideHeight = value.length > 0 ? THEME.leave.lineCm : 0
    return value.length > 0 ? 1 : 0
  }
}

/** Creates "LeaveCheck" under the entryway zone root at THEME.leave.anchorCm. */
export function createLeaveCheck(zoneRoot: SceneObject): MemoraLeaveCheckUI {
  const so = global.scene.createSceneObject("LeaveCheck")
  so.setParent(zoneRoot)
  const a = THEME.leave.anchorCm
  so.getTransform().setLocalPosition(new vec3(a[0], a[1], a[2]))
  const ui = so.createComponent(MemoraLeaveCheckUI.getTypeName()) as MemoraLeaveCheckUI
  ui.configure()
  return ui
}
