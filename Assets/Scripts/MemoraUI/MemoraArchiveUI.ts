// MEMAR — the Done archive: a small panel beside the desk with the last five
// completed memories, each with Restore, plus "Clear done" and a close X.
// Created at runtime by MemoraMain on the SceneObject "ArchivePanel" and built
// with configure(). Like the card, the SceneObject is the panel's BOTTOM-CENTRE
// and the panel's height fits its rows.
//
// Owns: the panel surface, pooled rows renamed "RestoreButton-<memoryId>",
// "ClearDoneButton", "ArchiveCloseButton", the empty state, its visibility.
// Must NOT: read or change the store; MemoraMain pushes items in and handles events.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
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
  TEXT_SECONDARY,
  THEME,
  tintFrom,
} from "./MemoraThemeUI"

export type ArchiveItem = {id: string; title: string; detail: string}

const ROWS = 5
const WARMUP_FRAMES = 3
const CLOSE_ICON = requireAsset("../../Icons/cancel.png") as Texture
const RESTORE_ICON = requireAsset("../../Icons/task_alt.png") as Texture

type Row = {item: FlexItem; restore: Button; title: Text; detail: Text}

@component
export class MemoraArchiveUI extends BaseScriptComponent {
  private _onRestore = new Event<string>()
  private _onClearDone = new Event<void>()
  private _onClose = new Event<void>()
  get onRestore(): PublicApi<string> {
    return this._onRestore.publicApi()
  }
  get onClearDone(): PublicApi<void> {
    return this._onClearDone.publicApi()
  }
  get onClose(): PublicApi<void> {
    return this._onClose.publicApi()
  }

  private plate!: BackPlate
  private surface!: SceneObject
  private content!: SceneObject
  private column!: FlexLayout
  private bodyItem!: FlexItem
  private bodyFlex!: FlexLayout
  private rows: Row[] = []
  private empty!: SceneObject
  private clearButton!: Button
  private tints: {btn: Button; tint: ButtonTint}[] = []
  private items: ArchiveItem[] = []
  private wantOpen = false
  private ready = false
  private built = false
  private heightCm = 0

  onAwake(): void {
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

  /** Builds the panel. Call once, right after createComponent. */
  configure(): void {
    if (this.built) return
    this.built = true
    const A = THEME.archive
    const w = A.widthCm
    const inner = w - A.padCm * 2
    this.sceneObject.createComponent("Component.Canvas")
    this.surface = makeObject(this.sceneObject, "Surface")
    this.plate = makePlate(this.surface, new vec2(w, 20), THEME.card.plate, undefined, true)
    // Content is a child of the surface so pinch rays that hit the plate count as hitting the panel.
    this.content = makeObject(this.surface, "Content", new vec3(0, 0, 0.6))
    const columnSo = makeFlex(this.content, "ArchiveColumn", FlexDirection.Column, w, 20, false, {
      gap: A.gapCm,
      padX: A.padCm,
      padY: A.padCm,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    this.column = columnSo.getComponent(FlexLayout.getTypeName()) as FlexLayout

    // Header: title + close.
    const header = makeFlex(columnSo, "ArchiveHeader", FlexDirection.Row, inner, A.headerCm, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    const titleCol = makeFlex(header, "ArchiveTitleColumn", FlexDirection.Column, inner - A.closeCm - 0.6, A.headerCm, true, {
      gap: 0.1,
      justify: FlexJustify.Center,
      align: FlexAlign.Start,
    })
    makeText(titleCol, "ArchiveTitle", "Done", "Headline1", 1, inner - A.closeCm - 0.6, 2.6, {align: HorizontalAlignment.Left})
    makeText(titleCol, "ArchiveSubtitle", "Last 5 completed", "Body", 1, inner - A.closeCm - 0.6, 1.6, {
      align: HorizontalAlignment.Left,
      color: TEXT_SECONDARY,
    })
    const closeSlot = makeSlot(header, "ArchiveCloseSlot", A.closeCm, A.headerCm)
    const close = this.button(closeSlot, "ArchiveCloseButton", A.closeCm, A.headerCm - 0.4, this.neutral())
    addButtonContent(close, CLOSE_ICON, "", 1, THEME.card.iconCm)
    close.onTriggerUp.add(() => this._onClose.invoke())

    // Body: pooled rows (unused rows collapse to zero height) + empty state.
    const body = makeSlot(columnSo, "ArchiveBody", inner, 10)
    this.bodyItem = body.getComponent(FlexItem.getTypeName()) as FlexItem
    const list = makeFlex(body, "ArchiveList", FlexDirection.Column, inner, 10, false, {
      gap: A.rowGapCm,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    this.bodyFlex = list.getComponent(FlexLayout.getTypeName()) as FlexLayout
    for (let i = 0; i < ROWS; i++) this.rows.push(this.buildRow(list, i, inner))
    this.empty = makeFlex(body, "ArchiveEmpty", FlexDirection.Column, inner, A.rowCm, false, {
      justify: FlexJustify.Center,
      align: FlexAlign.Center,
    })
    makeText(this.empty, "ArchiveEmptyText", "Nothing done yet today.", "Headline2", 1, inner, A.rowCm)

    // Footer: Clear done.
    const footer = makeFlex(columnSo, "ArchiveFooter", FlexDirection.Row, inner, A.footerCm, true, {
      justify: FlexJustify.End,
      align: FlexAlign.Center,
    })
    const clearSlot = makeSlot(footer, "ClearDoneSlot", A.clearCm, A.footerCm)
    this.clearButton = this.button(clearSlot, "ClearDoneButton", A.clearCm, A.footerCm - 0.4, tintFrom(THEME.card.danger))
    addButtonContent(this.clearButton, null, "Clear done", 1, THEME.card.iconCm)
    this.clearButton.onTriggerUp.add(() => this._onClearDone.invoke())
    this.applySize()
  }

  // ── Public API ────────────────────────────────────────────────────────────

  show(items: ArchiveItem[]): void {
    this.items = items.slice(0, ROWS)
    if (!this.built) return
    this.applySize()
    if (this.ready) this.apply()
  }

  setOpen(open: boolean): void {
    this.wantOpen = open
    if (this.ready) this.sceneObject.enabled = open
  }

  isOpen(): boolean {
    return this.wantOpen
  }

  getWidthCm(): number {
    return THEME.archive.widthCm
  }

  getHeightCm(): number {
    return this.heightCm
  }

  /** Ids currently listed (test helper). */
  shownIds(): string[] {
    return this.items.map((i) => i.id)
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private buildRow(list: SceneObject, i: number, inner: number): Row {
    const A = THEME.archive
    const textW = inner - A.restoreCm - 0.6
    const row = makeFlex(list, `ArchiveRow${i}`, FlexDirection.Row, inner, A.rowCm, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    const textCol = makeFlex(row, "ArchiveRowText", FlexDirection.Column, textW, A.rowCm, true, {
      gap: 0.05,
      justify: FlexJustify.Center,
      align: FlexAlign.Start,
    })
    const title = makeText(textCol, "ArchiveRowTitle", "", "Headline2", 1, textW, A.rowCm - 1.8, {
      align: HorizontalAlignment.Left,
      wrap: true,
    })
    const detail = makeText(textCol, "ArchiveRowDetail", "", "Body", 1, textW, 1.5, {
      align: HorizontalAlignment.Left,
      color: TEXT_SECONDARY,
    })
    const slot = makeSlot(row, `RestoreSlot${i}`, A.restoreCm, A.rowCm - 0.6)
    const restore = this.button(slot, `RestoreButton-unused-${i}`, A.restoreCm, A.rowCm - 0.8, tintFrom(THEME.card.primary))
    addButtonContent(restore, RESTORE_ICON, "Restore", 1, THEME.card.iconCm)
    restore.onTriggerUp.add(() => {
      const item = this.items[i]
      if (item) this._onRestore.invoke(item.id)
    })
    return {item: row.getComponent(FlexItem.getTypeName()) as FlexItem, restore, title, detail}
  }

  private applySize(): void {
    const A = THEME.archive
    const n = Math.max(1, this.items.length)
    for (let i = 0; i < ROWS; i++) this.rows[i].item.overrideHeight = i < this.items.length ? A.rowCm : 0
    const body = n * A.rowCm + (ROWS - 1) * A.rowGapCm
    const h = A.padCm * 2 + A.headerCm + A.footerCm + body + A.gapCm * 2
    this.heightCm = h
    this.bodyItem.overrideHeight = body
    this.bodyFlex.height = body
    this.column.height = h
    this.plate.size = new vec2(A.widthCm, h)
    this.surface.getTransform().setLocalPosition(new vec3(0, h / 2, 0))
    this.empty.getTransform().setLocalPosition(new vec3(0, body / 2 - A.rowCm / 2, 0))
  }

  private apply(): void {
    this.sceneObject.enabled = this.wantOpen
    for (let i = 0; i < ROWS; i++) {
      const row = this.rows[i]
      const item = this.items[i]
      row.restore.sceneObject.name = item ? `RestoreButton-${item.id}` : `RestoreButton-unused-${i}`
      row.restore.sceneObject.enabled = item !== undefined
      row.title.text = item ? item.title : ""
      row.detail.text = item ? item.detail : ""
    }
    this.empty.enabled = this.items.length === 0
    this.clearButton.sceneObject.enabled = this.items.length > 0
  }

  private neutral(): ButtonTint {
    return tintFrom(lighten(THEME.card.plate, THEME.card.neutralLift))
  }

  private button(parent: SceneObject, name: string, w: number, h: number, tint: ButtonTint): Button {
    const btn = makeButton(parent, name, w, h)
    this.tints.push({btn, tint})
    return btn
  }
}
