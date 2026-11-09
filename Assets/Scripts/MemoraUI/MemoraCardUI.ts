// MEMAR — the memory card that opens beside the selected object.
// Lives on the authored SceneObject "MemoryCard"; MemoraMain moves it to the
// selected object's card anchor. The SceneObject is the card's BOTTOM-CENTRE: the
// card grows upward from there, so it never drops onto the object below it.
//
// Owns: the card surface and its four views (list / quick-add presets + Speak /
// voice capture / details + delete confirm), the header (title, Add/Back, Close),
// the footer (status line + Undo), the open and Done animations, and its height
// (fits the content: no empty space under two rows). Rows, preset buttons and
// detail buttons are pooled and renamed per memory so LEAF can find
// "MemoryRow-<id>", "DoneButton-<id>", "Preset-<title>", "SpeakButton",
// "PriorityButton", "RepeatButton", "SnoozeButton", ...
// Expects: icon textures wired in the Inspector (optional — buttons fall back to text).
// Must NOT: read or change the memory store, or decide anything. It renders what
// MemoraMain pushes in (show*/set*) and reports user intent through events.
// Size note (~780 lines): one surface whose views share the header, footer,
// pooled buttons, input lock and sizing; most of the length is the declarative
// layout in build*(). Split a view into its own module if it grows further.

import animate from "SpectaclesInteractionKit.lspkg/Utils/animate"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {
  addButtonContent,
  addButtonLabel,
  applyTint,
  ButtonTint,
  lighten,
  makeButton,
  makeFlex,
  makeObject,
  makePlate,
  makeSlot,
  makeText,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  THEME,
  tintFrom,
} from "./MemoraThemeUI"

export type RowTone = "high" | "medium" | "low"
export type CardRow = {id: string; title: string; meta: string; tone: RowTone}
export type CardDetail = {id: string; title: string; due: string; created: string; priority: string; repeat: string}
export type FooterTone = "info" | "success" | "error"
export type CardView = "list" | "presets" | "voice" | "details"
export type VoiceState = "listening" | "preview"

const ROW_SLOTS = 3
const PRESET_SLOTS = 3
const WARMUP_FRAMES = 3
/** Ignore presses this long after the card content changes, so a double pinch can't hit the button that just moved under it. */
const INPUT_SETTLE_S = 0.25

// Fixed parts of the layout (cm); the rest comes from THEME.card.
const NAV_W = 9.4
const CLOSE_W = 5.0
const UNDO_W = 10
const PRIORITY_BTN_W = 11
const DELETE_W = 11
const CONFIRM_W = 8.6
const ICON_REPEAT = requireAsset("../../Icons/repeat.png") as Texture
const ICON_SNOOZE = requireAsset("../../Icons/snooze.png") as Texture
const SNOOZE_W = 11
const DETAIL_TITLE_H = 3.8
const DETAIL_LINE_H = 1.5
const DETAIL_GAP = 0.2
const ACTION_H = 4.6
const VOICE_STATUS_H = 2.2
const VOICE_TEXT_H = 5.2
const VOICE_GAP = 0.4

type RowSlot = {slot: SceneObject; item: FlexItem; main: Button; done: Button; title: Text; meta: Text}
type PresetSlot = {item: FlexItem; button: Button; label: Text}

@component
export class MemoraCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MemoraCardUI – memory card shown beside the selected object</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Icons</span>')
  @ui.group_start("Icons")
  @input
  @allowUndefined
  @hint("Close (X) button icon")
  closeIcon!: Texture

  @input
  @allowUndefined
  @hint("+ Add button icon")
  addIcon!: Texture

  @input
  @allowUndefined
  @hint("Back button icon")
  backIcon!: Texture

  @input
  @allowUndefined
  @hint("Done (tick) button icon")
  doneIcon!: Texture

  @input
  @allowUndefined
  @hint("Undo button icon")
  undoIcon!: Texture

  @input
  @allowUndefined
  @hint("Delete button icon")
  deleteIcon!: Texture

  @input
  @allowUndefined
  @hint("Priority button icon")
  priorityIcon!: Texture

  @input
  @allowUndefined
  @hint("Speak (microphone) button icon")
  micIcon!: Texture
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Size, colours, text scale and timings: THEME.card in MemoraThemeUI.ts</span>')

  // ── Events (UI → MemoraMain) ──────────────────────────────────────────────
  private _onClose = new Event<void>()
  private _onAdd = new Event<void>()
  private _onBack = new Event<void>()
  private _onUndo = new Event<void>()
  private _onRowSelected = new Event<string>()
  private _onDone = new Event<string>()
  private _onPresetSelected = new Event<number>()
  private _onPriority = new Event<string>()
  private _onDelete = new Event<string>()
  private _onConfirmDelete = new Event<string>()
  private _onCancelDelete = new Event<void>()
  private _onSpeak = new Event<void>()
  private _onSaveVoice = new Event<void>()
  private _onCancelVoice = new Event<void>()
  private _onRepeat = new Event<string>()
  private _onSnooze = new Event<string>()

  get onClose(): PublicApi<void> {
    return this._onClose.publicApi()
  }
  get onAdd(): PublicApi<void> {
    return this._onAdd.publicApi()
  }
  get onBack(): PublicApi<void> {
    return this._onBack.publicApi()
  }
  get onUndo(): PublicApi<void> {
    return this._onUndo.publicApi()
  }
  get onRowSelected(): PublicApi<string> {
    return this._onRowSelected.publicApi()
  }
  get onDone(): PublicApi<string> {
    return this._onDone.publicApi()
  }
  get onPresetSelected(): PublicApi<number> {
    return this._onPresetSelected.publicApi()
  }
  get onPriority(): PublicApi<string> {
    return this._onPriority.publicApi()
  }
  get onDelete(): PublicApi<string> {
    return this._onDelete.publicApi()
  }
  get onConfirmDelete(): PublicApi<string> {
    return this._onConfirmDelete.publicApi()
  }
  get onCancelDelete(): PublicApi<void> {
    return this._onCancelDelete.publicApi()
  }
  get onSpeak(): PublicApi<void> {
    return this._onSpeak.publicApi()
  }
  get onSaveVoice(): PublicApi<void> {
    return this._onSaveVoice.publicApi()
  }
  get onCancelVoice(): PublicApi<void> {
    return this._onCancelVoice.publicApi()
  }
  get onRepeat(): PublicApi<string> {
    return this._onRepeat.publicApi()
  }
  get onSnooze(): PublicApi<string> {
    return this._onSnooze.publicApi()
  }

  // ── Built parts ───────────────────────────────────────────────────────────
  private plate!: BackPlate
  private surface!: SceneObject
  private content!: SceneObject
  private column!: FlexLayout
  private bodyItem!: FlexItem
  private titleText!: Text
  private subtitleText!: Text
  private addButton!: Button
  private backButton!: Button
  private views: Record<CardView, {so: SceneObject; flex: FlexLayout}> = {} as Record<
    CardView,
    {so: SceneObject; flex: FlexLayout}
  >
  private rowSlots: RowSlot[] = []
  private emptyState!: SceneObject
  private emptyTitle!: Text
  private emptyHint!: Text
  private presetCaption!: Text
  private presetSlots: PresetSlot[] = []
  private voiceStatus!: Text
  private voiceText!: Text
  private saveVoiceButton!: Button
  private detailTitle!: Text
  private detailDue!: Text
  private detailCreated!: Text
  private detailPriority!: Text
  private detailRepeat!: Text
  private deleteRow!: SceneObject
  private confirmRow!: SceneObject
  private statusText!: Text
  private undoButton!: Button
  private handlers: {so: SceneObject; fn: () => void}[] = []
  private tints: {btn: Button; tint: ButtonTint}[] = []

  // ── View state (what to draw; no domain state) ────────────────────────────
  private wantOpen = false
  private view: CardView = "list"
  private rows: CardRow[] = []
  private presets: string[] = []
  private detail: CardDetail | undefined
  private confirming = false
  private voiceState: VoiceState = "listening"
  private undoVisible = false
  private ready = false
  private lockUntil = 0
  private heightCm = 0

  onAwake(): void {
    const C = THEME.card
    const w = C.widthCm
    const inner = w - C.padCm * 2

    this.sceneObject.createComponent("Component.Canvas")
    // Surface first, content second: the Canvas paints in hierarchy order.
    this.surface = makeObject(this.sceneObject, "Surface")
    this.plate = makePlate(this.surface, new vec2(w, 20), C.plate, undefined, true)
    // Content is a child of the surface so pinch rays that hit the plate count as hitting the panel.
    this.content = makeObject(this.surface, "Content", new vec3(0, 0, 0.6))
    const columnSo = makeFlex(this.content, "CardColumn", FlexDirection.Column, w, 20, false, {
      gap: C.gapCm,
      padX: C.padCm,
      padY: C.padCm,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    this.column = columnSo.getComponent(FlexLayout.getTypeName()) as FlexLayout
    this.buildHeader(columnSo, inner)
    this.buildBody(columnSo, inner)
    this.buildFooter(columnSo, inner)
    this.applySize()

    // Everything stays enabled for a few frames so UIKit buttons and layouts
    // initialize and lay out; then the requested state is applied.
    let frames = 0
    const warm = this.createEvent("UpdateEvent")
    warm.bind(() => {
      frames++
      if (frames < WARMUP_FRAMES) return
      warm.enabled = false
      this.ready = true
      for (const t of this.tints) applyTint(t.btn, t.tint)
      this.apply()
    })
  }

  // ── Public API (MemoraMain → UI) ──────────────────────────────────────────

  setOpen(open: boolean): void {
    const opening = open && !this.wantOpen
    if (opening) this.lock()
    this.wantOpen = open
    if (!this.ready) return
    this.sceneObject.enabled = open
    if (opening) this.playOpen()
  }

  isOpen(): boolean {
    return this.wantOpen
  }

  getWidthCm(): number {
    return THEME.card.widthCm
  }

  /** Current card height (it fits the content of the current view). */
  getHeightCm(): number {
    return this.heightCm
  }

  showList(title: string, subtitle: string, rows: CardRow[], emptyTitle: string, emptyHint: string): void {
    const shown = rows.slice(0, ROW_SLOTS)
    const changed = this.view !== "list" || shown.map((r) => r.id).join("|") !== this.rows.map((r) => r.id).join("|")
    this.view = "list"
    this.rows = shown
    this.setTitle(title, subtitle)
    this.emptyTitle.text = emptyTitle
    this.emptyHint.text = emptyHint
    if (changed) this.lock()
    this.refreshView()
  }

  showPresets(title: string, subtitle: string, caption: string, presetTitles: string[]): void {
    if (this.view !== "presets") this.lock()
    this.view = "presets"
    this.presets = presetTitles.slice(0, PRESET_SLOTS)
    this.setTitle(title, subtitle)
    this.presetCaption.text = caption
    this.refreshView()
  }

  /** Voice capture: "listening" shows the live words; "preview" shows the cleaned title with Save. */
  showVoice(title: string, subtitle: string, state: VoiceState, status: string, text: string): void {
    if (this.view !== "voice" || this.voiceState !== state) this.lock()
    this.view = "voice"
    this.voiceState = state
    this.setTitle(title, subtitle)
    this.voiceStatus.text = status
    this.voiceText.text = text
    this.refreshView()
  }

  showDetails(title: string, subtitle: string, detail: CardDetail, confirming: boolean): void {
    if (this.view !== "details" || this.confirming !== confirming) this.lock()
    this.view = "details"
    this.detail = detail
    this.confirming = confirming
    this.setTitle(title, subtitle)
    this.detailTitle.text = detail.title
    this.detailDue.text = detail.due
    this.detailCreated.text = detail.created
    this.detailPriority.text = detail.priority
    this.detailRepeat.text = detail.repeat
    this.refreshView()
  }

  /** Footer status line ("Saved to Notebook", "Couldn't save", "+1 more", ...). */
  setFooter(text: string, tone: FooterTone): void {
    this.statusText.text = text
    this.statusText.textFill.color = THEME.footer[tone]
  }

  setUndoVisible(visible: boolean): void {
    this.undoVisible = visible
    if (this.ready) this.undoButton.sceneObject.enabled = visible
  }

  // ── Test hooks (MemoraSelfTest / LEAF helpers) ────────────────────────────

  /** Runs the same handler a pinch on the named, currently visible button runs. */
  debugPress(name: string): boolean {
    for (const h of this.handlers) {
      if (h.so.name === name && h.so.isEnabledInHierarchy) {
        h.fn()
        return true
      }
    }
    return false
  }

  debugView(): CardView {
    return this.view
  }

  debugRowIds(): string[] {
    return this.rows.map((r) => r.id)
  }

  debugRowTitles(): string[] {
    return this.rows.map((r) => r.title)
  }

  debugRowMetas(): string[] {
    return this.rows.map((r) => r.meta)
  }

  debugUndoVisible(): boolean {
    return this.undoVisible
  }

  debugConfirming(): boolean {
    return this.view === "details" && this.confirming
  }

  debugVoice(): {state: VoiceState; status: string; text: string} {
    return {state: this.voiceState, status: this.voiceStatus.text, text: this.voiceText.text}
  }

  debugFooter(): string {
    return this.statusText.text
  }

  // ── Sizing ────────────────────────────────────────────────────────────────

  private bodyHeight(): number {
    const C = THEME.card
    switch (this.view) {
      // Unused slots collapse to zero height but keep their gap.
      case "list":
        return Math.max(1, this.rows.length) * C.rowCm + (ROW_SLOTS - 1) * C.rowGapCm
      case "presets":
        return C.captionCm + (this.presets.length + 1) * C.presetCm + (PRESET_SLOTS + 1) * C.presetGapCm
      case "voice":
        return VOICE_STATUS_H + VOICE_TEXT_H + ACTION_H + VOICE_GAP * 2
      case "details":
        return DETAIL_TITLE_H + DETAIL_LINE_H * 2 + ACTION_H * 3 + DETAIL_GAP * 5
    }
  }

  /** Fits the plate and layout to the current view; the bottom edge stays on the anchor. */
  private applySize(): void {
    const C = THEME.card
    for (let i = 0; i < ROW_SLOTS; i++) this.rowSlots[i].item.overrideHeight = i === 0 || i < this.rows.length ? C.rowCm : 0
    for (let i = 0; i < PRESET_SLOTS; i++) this.presetSlots[i].item.overrideHeight = i < this.presets.length ? C.presetCm : 0
    const body = this.bodyHeight()
    const h = C.padCm * 2 + C.headerCm + C.footerCm + body + C.gapCm * 2
    this.heightCm = h
    this.bodyItem.overrideHeight = body
    this.column.height = h
    for (const k of Object.keys(this.views) as CardView[]) this.views[k].flex.height = body
    this.plate.size = new vec2(C.widthCm, h)
    this.surface.getTransform().setLocalPosition(new vec3(0, h / 2, 0))
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  private buildHeader(parent: SceneObject, inner: number): void {
    const C = THEME.card
    const titleW = inner - NAV_W - CLOSE_W - 1.2
    const header = makeFlex(parent, "Header", FlexDirection.Row, inner, C.headerCm, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    const titleCol = makeFlex(header, "TitleColumn", FlexDirection.Column, titleW, C.headerCm, true, {
      gap: 0.1,
      justify: FlexJustify.Center,
      align: FlexAlign.Start,
    })
    this.titleText = makeText(titleCol, "CardTitle", "", "Headline1", 1, titleW, 2.8, {align: HorizontalAlignment.Left})
    this.subtitleText = makeText(titleCol, "CardSubtitle", "", "Body", 1, titleW, 1.6, {
      align: HorizontalAlignment.Left,
      color: TEXT_SECONDARY,
    })

    const navSlot = makeSlot(header, "NavSlot", NAV_W, C.headerCm)
    this.addButton = this.button(navSlot, "AddButton", NAV_W, C.headerCm - 0.4, tintFrom(C.primary), () =>
      this._onAdd.invoke(),
    )
    addButtonContent(this.addButton, this.addIcon ?? null, this.addIcon ? "Add" : "+ Add", 1, C.iconCm)
    this.backButton = this.button(navSlot, "BackButton", NAV_W, C.headerCm - 0.4, this.neutralTint(), () =>
      this._onBack.invoke(),
    )
    addButtonContent(this.backButton, this.backIcon ?? null, "Back", 1, C.iconCm)

    const closeSlot = makeSlot(header, "CloseSlot", CLOSE_W, C.headerCm)
    const close = this.button(closeSlot, "CloseButton", CLOSE_W, C.headerCm - 0.4, this.neutralTint(), () =>
      this._onClose.invoke(),
    )
    addButtonContent(close, this.closeIcon ?? null, this.closeIcon ? "" : "X", 1, C.iconCm)
  }

  private buildBody(parent: SceneObject, inner: number): void {
    const C = THEME.card
    const body = makeSlot(parent, "Body", inner, 10)
    this.bodyItem = body.getComponent(FlexItem.getTypeName()) as FlexItem
    const view = (name: string, key: CardView, gap: number): SceneObject => {
      const so = makeFlex(body, name, FlexDirection.Column, inner, 10, false, {
        gap,
        justify: FlexJustify.Start,
        align: FlexAlign.Center,
      })
      this.views[key] = {so, flex: so.getComponent(FlexLayout.getTypeName()) as FlexLayout}
      return so
    }
    const list = view("ListView", "list", C.rowGapCm)
    for (let i = 0; i < ROW_SLOTS; i++) this.rowSlots.push(this.buildRow(list, i, inner))
    this.buildPresets(view("PresetsView", "presets", C.presetGapCm), inner)
    this.buildVoice(view("VoiceView", "voice", VOICE_GAP), inner)
    this.buildDetails(view("DetailsView", "details", DETAIL_GAP), inner)
  }

  private buildRow(listView: SceneObject, i: number, inner: number): RowSlot {
    const C = THEME.card
    const mainW = inner - C.doneButtonCm - 0.6
    const textW = mainW - 1.6
    const slot = makeFlex(listView, `RowSlot${i}`, FlexDirection.Row, inner, C.rowCm, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })

    const mainSlot = makeSlot(slot, `RowMainSlot${i}`, mainW, C.rowCm)
    const main = this.button(mainSlot, `MemoryRow-unused-${i}`, mainW, C.rowCm, this.neutralTint(), () => {
      const row = this.rows[i]
      if (row) this._onRowSelected.invoke(row.id)
    })
    const textCol = makeFlex(main.sceneObject, "RowText", FlexDirection.Column, textW, C.rowCm - 0.4, false, {
      gap: 0.05,
      justify: FlexJustify.Center,
      align: FlexAlign.Start,
    })
    textCol.getTransform().setLocalPosition(new vec3(0, 0, 0.08))
    const title = makeText(textCol, "RowTitle", "", "HeadlineXL", C.rowTitleScale, textW, C.rowCm - 1.9, {
      align: HorizontalAlignment.Left,
      wrap: true,
    })
    const meta = makeText(textCol, "RowMeta", "", "Subheadline", 1, textW, 1.4, {align: HorizontalAlignment.Left})

    const doneSlot = makeSlot(slot, `DoneSlot${i}`, C.doneButtonCm, C.doneButtonCm)
    const done = this.button(doneSlot, `DoneButton-unused-${i}`, C.doneButtonCm, C.doneButtonCm, tintFrom(C.done), () =>
      this.animateDone(i),
    )
    addButtonContent(done, this.doneIcon ?? null, this.doneIcon ? "" : "Done", 1, C.iconCm + 0.6)

    if (i === 0) {
      // Empty state shares the first row's space. It has no FlexItem, so the
      // row layout ignores it and it stays centred across the full width.
      this.emptyState = makeFlex(slot, "EmptyState", FlexDirection.Column, inner, C.rowCm, false, {
        gap: 0.2,
        justify: FlexJustify.Center,
        align: FlexAlign.Center,
      })
      this.emptyTitle = makeText(this.emptyState, "EmptyTitle", "", "Headline2", 1, inner, 2.4)
      this.emptyHint = makeText(this.emptyState, "EmptyHint", "", "Body", 1, inner, 1.8, {color: TEXT_SECONDARY})
    }
    return {slot, item: slot.getComponent(FlexItem.getTypeName()) as FlexItem, main, done, title, meta}
  }

  private buildPresets(view: SceneObject, inner: number): void {
    const C = THEME.card
    this.presetCaption = makeText(view, "PresetCaption", "", "Body", 1.05, inner, C.captionCm, {color: TEXT_SECONDARY})
    for (let i = 0; i < PRESET_SLOTS; i++) {
      const slot = makeSlot(view, `PresetSlot${i}`, inner, C.presetCm)
      const button = this.button(slot, `Preset-unused-${i}`, inner, C.presetCm, tintFrom(C.primary), () =>
        this._onPresetSelected.invoke(i),
      )
      const label = addButtonLabel(button, "", "Headline2", 1, inner - 1.6, C.presetCm - 0.4)
      this.presetSlots.push({item: slot.getComponent(FlexItem.getTypeName()) as FlexItem, button, label})
    }
    const speakSlot = makeSlot(view, "SpeakSlot", inner, C.presetCm)
    const speak = this.button(speakSlot, "SpeakButton", inner, C.presetCm, this.neutralTint(), () => this._onSpeak.invoke())
    addButtonContent(speak, this.micIcon ?? null, "Speak a new memory", 1, C.iconCm)
  }

  private buildVoice(view: SceneObject, inner: number): void {
    const C = THEME.card
    this.voiceStatus = makeText(view, "VoiceStatus", "", "Headline2", 1, inner, VOICE_STATUS_H, {color: THEME.detect.caption})
    this.voiceText = makeText(view, "VoiceText", "", "HeadlineXL", C.rowTitleScale, inner, VOICE_TEXT_H, {wrap: true})
    const actions = makeFlex(view, "VoiceActions", FlexDirection.Row, inner, ACTION_H, true, {
      gap: 0.8,
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })
    const cancelSlot = makeSlot(actions, "CancelVoiceSlot", 10, ACTION_H)
    const cancel = this.button(cancelSlot, "CancelVoiceButton", 10, ACTION_H, this.neutralTint(), () =>
      this._onCancelVoice.invoke(),
    )
    addButtonContent(cancel, null, "Cancel", 1, C.iconCm)
    const saveSlot = makeSlot(actions, "SaveVoiceSlot", 10, ACTION_H)
    this.saveVoiceButton = this.button(saveSlot, "SaveVoiceButton", 10, ACTION_H, tintFrom(C.done), () =>
      this._onSaveVoice.invoke(),
    )
    addButtonContent(this.saveVoiceButton, this.doneIcon ?? null, "Save", 1, C.iconCm)
  }

  private buildDetails(view: SceneObject, inner: number): void {
    const C = THEME.card
    const left = {align: HorizontalAlignment.Left}
    this.detailTitle = makeText(view, "DetailTitle", "", "Headline1", 1, inner, DETAIL_TITLE_H, {...left, wrap: true})
    this.detailDue = makeText(view, "DetailDue", "", "Body", 1.1, inner, DETAIL_LINE_H, {...left, color: TEXT_SECONDARY})
    this.detailCreated = makeText(view, "DetailCreated", "", "Body", 1.1, inner, DETAIL_LINE_H, {...left, color: TEXT_SECONDARY})

    const priorityRow = makeFlex(view, "PriorityRow", FlexDirection.Row, inner, ACTION_H, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    this.detailPriority = makeText(priorityRow, "DetailPriority", "", "Headline2", 1, inner - PRIORITY_BTN_W - 0.6, ACTION_H, left)
    const prioritySlot = makeSlot(priorityRow, "PrioritySlot", PRIORITY_BTN_W, ACTION_H)
    const priority = this.button(prioritySlot, "PriorityButton", PRIORITY_BTN_W, ACTION_H, this.neutralTint(), () => {
      if (this.detail) this._onPriority.invoke(this.detail.id)
    })
    addButtonContent(priority, this.priorityIcon ?? null, "Change", 1, C.iconCm)

    // Routine: Once → Daily → Weekly.
    const repeatRow = makeFlex(view, "RepeatRow", FlexDirection.Row, inner, ACTION_H, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    this.detailRepeat = makeText(repeatRow, "DetailRepeat", "", "Headline2", 1, inner - PRIORITY_BTN_W - 0.6, ACTION_H, left)
    const repeatSlot = makeSlot(repeatRow, "RepeatSlot", PRIORITY_BTN_W, ACTION_H)
    const repeat = this.button(repeatSlot, "RepeatButton", PRIORITY_BTN_W, ACTION_H, this.neutralTint(), () => {
      if (this.detail) this._onRepeat.invoke(this.detail.id)
    })
    addButtonContent(repeat, ICON_REPEAT, "Change", 1, C.iconCm)

    const actions = makeSlot(view, "ActionsSlot", inner, ACTION_H)
    // Delete sits on the left; Confirm sits on the right, so a double pinch on
    // Delete can only ever land on Cancel ("Keep"), never on Confirm.
    this.deleteRow = makeFlex(actions, "DeleteRow", FlexDirection.Row, inner, ACTION_H, false, {
      justify: FlexJustify.SpaceBetween,
      align: FlexAlign.Center,
    })
    const deleteSlot = makeSlot(this.deleteRow, "DeleteSlot", DELETE_W, ACTION_H)
    const del = this.button(deleteSlot, "DeleteButton", DELETE_W, ACTION_H, tintFrom(C.danger), () => {
      if (this.detail) this._onDelete.invoke(this.detail.id)
    })
    addButtonContent(del, this.deleteIcon ?? null, "Delete", 1, C.iconCm)
    const snoozeSlot = makeSlot(this.deleteRow, "SnoozeSlot", SNOOZE_W, ACTION_H)
    const snooze = this.button(snoozeSlot, "SnoozeButton", SNOOZE_W, ACTION_H, tintFrom(C.primary), () => {
      if (this.detail) this._onSnooze.invoke(this.detail.id)
    })
    addButtonContent(snooze, ICON_SNOOZE, "Later +1h", 1, C.iconCm)

    this.confirmRow = makeFlex(actions, "ConfirmRow", FlexDirection.Row, inner, ACTION_H, false, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    makeText(this.confirmRow, "ConfirmPrompt", "Delete?", "Headline2", 1, inner - CONFIRM_W * 2 - 1.2, ACTION_H, left)
    const cancelSlot = makeSlot(this.confirmRow, "CancelSlot", CONFIRM_W, ACTION_H)
    const cancel = this.button(cancelSlot, "CancelDeleteButton", CONFIRM_W, ACTION_H, this.neutralTint(), () =>
      this._onCancelDelete.invoke(),
    )
    addButtonContent(cancel, null, "Keep", 1, C.iconCm)
    const confirmSlot = makeSlot(this.confirmRow, "ConfirmSlot", CONFIRM_W, ACTION_H)
    const confirm = this.button(confirmSlot, "ConfirmDeleteButton", CONFIRM_W, ACTION_H, tintFrom(C.danger), () => {
      if (this.detail) this._onConfirmDelete.invoke(this.detail.id)
    })
    addButtonContent(confirm, this.deleteIcon ?? null, "Delete", 1, C.iconCm)
  }

  private buildFooter(parent: SceneObject, inner: number): void {
    const C = THEME.card
    const footer = makeFlex(parent, "Footer", FlexDirection.Row, inner, C.footerCm, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    this.statusText = makeText(footer, "StatusText", "", "Subheadline", 1.05, inner - UNDO_W - 0.6, C.footerCm, {
      align: HorizontalAlignment.Left,
      wrap: true,
      color: TEXT_SECONDARY,
    })
    const undoSlot = makeSlot(footer, "UndoSlot", UNDO_W, C.footerCm)
    this.undoButton = this.button(undoSlot, "UndoButton", UNDO_W, C.footerCm - 0.4, tintFrom(C.primary), () =>
      this._onUndo.invoke(),
    )
    addButtonContent(this.undoButton, this.undoIcon ?? null, "Undo", 1, C.iconCm)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setTitle(title: string, subtitle: string): void {
    this.titleText.text = title
    this.subtitleText.text = subtitle
  }

  private neutralTint(): ButtonTint {
    return tintFrom(lighten(THEME.card.plate, THEME.card.neutralLift))
  }

  private button(parent: SceneObject, name: string, w: number, h: number, tint: ButtonTint, handler: () => void): Button {
    const btn = makeButton(parent, name, w, h)
    this.tints.push({btn, tint})
    this.handlers.push({so: btn.sceneObject, fn: handler})
    btn.onTriggerUp.add(() => {
      if (getTime() < this.lockUntil) return
      handler()
    })
    return btn
  }

  private lock(): void {
    this.lockUntil = getTime() + INPUT_SETTLE_S
  }

  private refreshView(): void {
    this.applySize()
    if (this.ready) this.apply()
  }

  /** Distance-based size set by the placement (MemoraPlacement); the open animation scales relative to it. */
  private baseScale = 1

  getBaseScale(): number {
    return this.baseScale
  }

  setBaseScale(scale: number): void {
    this.baseScale = scale > 0 ? scale : 1
    const s = this.baseScale
    this.sceneObject.getTransform().setLocalScale(new vec3(s, s, s))
  }

  /** Quick scale-in when the card opens. */
  private playOpen(): void {
    const t = this.sceneObject.getTransform()
    const b = this.baseScale
    t.setLocalScale(new vec3(0.9 * b, 0.9 * b, 0.9 * b))
    animate({
      duration: THEME.card.openSeconds,
      easing: "ease-out-quad",
      update: (k: number) => {
        const s = (0.9 + 0.1 * k) * b
        t.setLocalScale(new vec3(s, s, s))
      },
    })
  }

  /** Done: the row fades and shrinks, then MemoraMain completes the memory. */
  private animateDone(i: number): void {
    const row = this.rows[i]
    if (!row) return
    const slot = this.rowSlots[i]
    const t = slot.slot.getTransform()
    animate({
      duration: THEME.card.rowOutSeconds,
      easing: "ease-in-quad",
      update: (k: number) => {
        slot.main.opacity = 1 - 0.7 * k
        slot.done.opacity = 1 - 0.7 * k
        t.setLocalScale(new vec3(1 - 0.08 * k, 1 - 0.08 * k, 1))
      },
      ended: () => {
        slot.main.opacity = 1
        slot.done.opacity = 1
        t.setLocalScale(new vec3(1, 1, 1))
        this._onDone.invoke(row.id)
      },
    })
  }

  /** Push the stored view state onto the scene (names, texts, visibility). */
  private apply(): void {
    this.sceneObject.enabled = this.wantOpen
    const view = this.view
    for (const k of Object.keys(this.views) as CardView[]) this.views[k].so.enabled = k === view
    this.addButton.sceneObject.enabled = view === "list"
    this.backButton.sceneObject.enabled = view === "presets" || view === "details"
    this.undoButton.sceneObject.enabled = this.undoVisible

    for (let i = 0; i < ROW_SLOTS; i++) {
      const slot = this.rowSlots[i]
      const row = this.rows[i]
      if (row) {
        slot.main.sceneObject.name = `MemoryRow-${row.id}`
        slot.done.sceneObject.name = `DoneButton-${row.id}`
        slot.title.text = row.title
        slot.meta.text = row.meta
        slot.meta.textFill.color = THEME.priority[row.tone]
      } else {
        slot.main.sceneObject.name = `MemoryRow-unused-${i}`
        slot.done.sceneObject.name = `DoneButton-unused-${i}`
        slot.title.text = ""
        slot.meta.text = ""
      }
      slot.main.sceneObject.enabled = row !== undefined
      slot.done.sceneObject.enabled = row !== undefined
    }
    this.emptyState.enabled = view === "list" && this.rows.length === 0

    for (let i = 0; i < PRESET_SLOTS; i++) {
      const slot = this.presetSlots[i]
      const title = this.presets[i]
      slot.button.sceneObject.name = title !== undefined ? `Preset-${title}` : `Preset-unused-${i}`
      slot.label.text = title ?? ""
      slot.label.textFill.color = TEXT_PRIMARY
      slot.button.sceneObject.enabled = title !== undefined
    }

    this.saveVoiceButton.sceneObject.enabled = view === "voice" && this.voiceState === "preview"
    this.deleteRow.enabled = view === "details" && !this.confirming
    this.confirmRow.enabled = view === "details" && this.confirming
  }
}
