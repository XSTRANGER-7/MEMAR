// MEMAR — the desk front edge: today strip ("8 pending · 3 due today" + small
// icon buttons Scan / Look-to-detect / Done list / Help "?"), the out-of-view zone hints at
// the edge's ends ("‹ Entryway · 2", "Kitchen · 2 ›") and the first-run hint.
// Lives on the authored SceneObject "TodayStrip" (child of "Desk"); everything
// stays world-anchored to the desk, nothing is head-locked.
//
// Owns: the strip surface + its UIKit buttons, and the child labels
// "ZoneHint-<zoneId>" / "HintLabel" (MemoraLabelUI). Style comes from THEME.
// Expects: nothing wired; MemoraMain pushes counts and listens to the events.
// Must NOT: read the memory store or decide anything. It is a passive view.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {createLabel, MemoraLabelUI} from "./MemoraLabelUI"
import {
  addButtonContent,
  applyTint,
  ButtonTint,
  lighten,
  makeButton,
  makeFlex,
  makeObject,
  makePlate,
  makeSlot,
  makeText,
  THEME,
  tintFrom,
} from "./MemoraThemeUI"

const ICON_SCAN = requireAsset("../../Icons/center_focus_strong.png") as Texture
const ICON_DETECT = requireAsset("../../Icons/visibility.png") as Texture
const ICON_DONE_LIST = requireAsset("../../Icons/task_alt.png") as Texture
const ICON_HELP = requireAsset("../../Icons/help.png") as Texture
const BUTTONS = 4

const WARMUP_FRAMES = 3

@component
export class MemoraTodayStripUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MemoraTodayStripUI – desk-edge summary, Scan / Detect / Done / Help buttons, zone hints</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Size and colours: THEME.strip in MemoraThemeUI.ts</span>')

  private _onScan = new Event<void>()
  private _onDetectToggle = new Event<void>()
  private _onDoneList = new Event<void>()
  private _onHelp = new Event<void>()
  get onScan(): PublicApi<void> {
    return this._onScan.publicApi()
  }
  get onDetectToggle(): PublicApi<void> {
    return this._onDetectToggle.publicApi()
  }
  get onDoneList(): PublicApi<void> {
    return this._onDoneList.publicApi()
  }
  get onHelp(): PublicApi<void> {
    return this._onHelp.publicApi()
  }

  private label: Text | undefined
  private detectButton: Button | undefined
  private tints: {btn: Button; tint: ButtonTint}[] = []
  private zoneHints: Record<string, MemoraLabelUI> = {}
  private hintLabel: MemoraLabelUI | undefined
  private detectOn = true
  private ready = false

  onAwake(): void {
    const S = THEME.strip
    this.sceneObject.createComponent("Component.Canvas")
    makePlate(this.sceneObject, new vec2(S.widthCm, S.heightCm), S.plate, THEME.radiusCm * 1.5)
    const content = makeObject(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    const row = makeFlex(content, "StripRow", FlexDirection.Row, S.widthCm, S.heightCm, false, {
      gap: S.gapCm,
      padX: S.padCm,
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })
    const b = S.buttonCm
    const labelW = S.widthCm - S.padCm * 2 - (b + S.gapCm) * BUTTONS
    this.label = makeText(row, "StripLabel", "", "Subheadline", 1, labelW, S.heightCm - 0.6)
    this.addIconButton(row, "ScanButton", ICON_SCAN, tintFrom(THEME.card.primary), () => this._onScan.invoke())
    this.detectButton = this.addIconButton(row, "DetectToggle", ICON_DETECT, tintFrom(THEME.card.primary), () =>
      this._onDetectToggle.invoke(),
    )
    this.addIconButton(row, "DoneListButton", ICON_DONE_LIST, this.neutral(), () => this._onDoneList.invoke())
    this.addIconButton(row, "HelpButton", ICON_HELP, this.neutral(), () => this._onHelp.invoke())

    // Zone hints sit at the far ends of the desk edge, pointing towards their zones.
    const hintX = S.zoneHintOffsetCm
    this.zoneHints.entryway = createLabel(this.sceneObject, "ZoneHint-entryway", new vec3(-hintX, 0, 0), "", 12, 3.8, THEME.label.hint)
    this.zoneHints.kitchen = createLabel(this.sceneObject, "ZoneHint-kitchen", new vec3(hintX, 0, 0), "", 12, 3.8, THEME.label.hint)
    this.hintLabel = createLabel(
      this.sceneObject,
      "HintLabel",
      new vec3(0, S.heightCm / 2 + 2.2, 0),
      "Look at something, or pinch it, to see its memories",
      S.hintWidthCm,
      3.0,
      THEME.label.firstRun,
    )

    let frames = 0
    const warm = this.createEvent("UpdateEvent")
    warm.bind(() => {
      frames++
      if (frames < WARMUP_FRAMES) return
      warm.enabled = false
      this.ready = true
      for (const t of this.tints) applyTint(t.btn, t.tint)
      this.applyDetectTint()
    })
  }

  /** "8 pending · 3 due today" (plus overdue when there is any). */
  setCounts(pending: number, dueToday: number, overdue: number): void {
    if (!this.label) return
    if (pending === 0) {
      this.label.text = "All clear · nothing pending"
      return
    }
    let line = `${pending} pending · ${dueToday} due today`
    if (overdue > 0) line += ` · ${overdue} overdue`
    this.label.text = line
  }

  /** "‹ Entryway · 2" on the left end, "Kitchen · 2 ›" on the right end; hidden at 0. */
  setZoneHint(zoneId: string, zoneName: string, pending: number, side: "left" | "right"): void {
    const hint = this.zoneHints[zoneId]
    if (!hint) return
    hint.setText(side === "left" ? `‹ ${zoneName} · ${pending}` : `${zoneName} · ${pending} ›`)
    hint.setVisible(pending > 0)
  }

  setHintVisible(visible: boolean): void {
    if (this.hintLabel) this.hintLabel.setVisible(visible)
  }

  setHintText(text: string): void {
    if (this.hintLabel) this.hintLabel.setText(text)
  }

  getHintText(): string {
    return this.hintLabel && this.hintLabel.isShown() ? this.hintLabel.getText() : ""
  }

  /** Look-to-detect toggle state: blue when on, neutral when off. */
  setDetectOn(on: boolean): void {
    this.detectOn = on
    if (this.ready) this.applyDetectTint()
  }

  getText(): string {
    return this.label ? this.label.text : ""
  }

  getZoneHintText(zoneId: string): string {
    const hint = this.zoneHints[zoneId]
    return hint && hint.isShown() ? hint.getText() : ""
  }

  private applyDetectTint(): void {
    if (this.detectButton) applyTint(this.detectButton, this.detectOn ? tintFrom(THEME.card.primary) : this.neutral())
  }

  private neutral(): ButtonTint {
    return tintFrom(lighten(THEME.strip.plate, THEME.card.neutralLift))
  }

  private addIconButton(row: SceneObject, name: string, icon: Texture, tint: ButtonTint, onPress: () => void): Button {
    const b = THEME.strip.buttonCm
    const slot = makeSlot(row, `${name}Slot`, b, b)
    const btn = makeButton(slot, name, b, b)
    addButtonContent(btn, icon, "", 1, THEME.strip.iconCm)
    btn.onTriggerUp.add(onPress)
    this.tints.push({btn, tint})
    return btn
  }
}
