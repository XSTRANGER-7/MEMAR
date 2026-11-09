// MEMAR — the help card: four short lines, each with a small icon, explaining
// how to use MEMAR. Opened by "?" (HelpButton) on the today strip, closed by
// HelpCloseButton. Created at runtime by MemoraMain on the SceneObject
// "HelpCard" (child of "Desk", above and behind the laptop: THEME.help) and built
// with configure(). Like the card and the Done list, the SceneObject is the
// panel's BOTTOM-CENTRE.
//
// Owns: the panel surface (solid, so pinches on it don't fall through), the
// header + close button, the four icon lines, its visibility.
// Must NOT: read the store or decide when to open; MemoraMain does that.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {
  addButtonContent,
  applyTint,
  ButtonTint,
  lighten,
  makeButton,
  makeFlex,
  makeIcon,
  makeObject,
  makePlate,
  makeSlot,
  makeText,
  TEXT_SECONDARY,
  THEME,
  tintFrom,
} from "./MemoraThemeUI"

const WARMUP_FRAMES = 3
const CLOSE_ICON = requireAsset("../../Icons/cancel.png") as Texture

/** The four help lines, in order, with their icons. */
export const HELP_LINES: {icon: Texture; text: string}[] = [
  {icon: requireAsset("../../Icons/visibility.png") as Texture, text: "Look at a thing, or pinch it, to see its memories"},
  {icon: requireAsset("../../Icons/task_alt.png") as Texture, text: "Done ticks it off · Undo if you slip"},
  {icon: requireAsset("../../Icons/add_circle.png") as Texture, text: "+ Add: pick a preset or Speak"},
  {icon: requireAsset("../../Icons/swap_horiz.png") as Texture, text: "Turn left and right: entryway and kitchen"},
]

@component
export class MemoraHelpUI extends BaseScriptComponent {
  private _onClose = new Event<void>()
  get onClose(): PublicApi<void> {
    return this._onClose.publicApi()
  }

  private close: Button | undefined
  private closeTint: ButtonTint | undefined
  private wantOpen = false
  private ready = false
  private built = false
  private heightCm = 0
  private openedAt = -1

  onAwake(): void {
    let frames = 0
    const warm = this.createEvent("UpdateEvent")
    warm.bind(() => {
      frames++
      if (frames < WARMUP_FRAMES) return
      warm.enabled = false
      this.ready = true
      if (this.close && this.closeTint) applyTint(this.close, this.closeTint)
      this.sceneObject.enabled = this.wantOpen
    })
    // Quick scale-in on open, matching the card.
    this.createEvent("UpdateEvent").bind(() => {
      if (this.openedAt < 0) return
      const t = Math.min(1, (getTime() - this.openedAt) / THEME.card.openSeconds)
      const s = 0.9 + 0.1 * (1 - (1 - t) * (1 - t))
      this.sceneObject.getTransform().setLocalScale(new vec3(s, s, s))
      if (t >= 1) this.openedAt = -1
    })
  }

  /** Builds the panel. Call once, right after createComponent. */
  configure(): void {
    if (this.built) return
    this.built = true
    const H = THEME.help
    const w = H.widthCm
    const inner = w - H.padCm * 2
    const rows = HELP_LINES.length
    const h = H.padCm * 2 + H.headerCm + H.gapCm + rows * H.rowCm + (rows - 1) * H.rowGapCm
    this.heightCm = h

    this.sceneObject.createComponent("Component.Canvas")
    const surface = makeObject(this.sceneObject, "Surface", new vec3(0, h / 2, 0))
    makePlate(surface, new vec2(w, h), THEME.card.plate, undefined, true)
    // Content is a child of the surface so pinch rays that hit the plate count as hitting the panel.
    const content = makeObject(surface, "Content", new vec3(0, 0, 0.6))
    const column = makeFlex(content, "HelpColumn", FlexDirection.Column, w, h, false, {
      gap: H.gapCm,
      padX: H.padCm,
      padY: H.padCm,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })

    const header = makeFlex(column, "HelpHeader", FlexDirection.Row, inner, H.headerCm, true, {
      gap: 0.6,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    makeText(header, "HelpTitle", "How MEMAR works", "Headline1", H.textScale, inner - H.closeCm - 0.6, H.headerCm, {
      align: HorizontalAlignment.Left,
    })
    const closeSlot = makeSlot(header, "HelpCloseSlot", H.closeCm, H.headerCm)
    this.close = makeButton(closeSlot, "HelpCloseButton", H.closeCm, H.headerCm - 0.4)
    this.closeTint = tintFrom(lighten(THEME.card.plate, THEME.card.neutralLift))
    addButtonContent(this.close, CLOSE_ICON, "", 1, H.iconCm)
    this.close.onTriggerUp.add(() => this._onClose.invoke())

    const list = makeFlex(column, "HelpLines", FlexDirection.Column, inner, rows * H.rowCm + (rows - 1) * H.rowGapCm, true, {
      gap: H.rowGapCm,
      justify: FlexJustify.Start,
      align: FlexAlign.Center,
    })
    const textW = inner - H.iconCm - 0.8
    HELP_LINES.forEach((line, i) => {
      const row = makeFlex(list, `HelpLine${i}`, FlexDirection.Row, inner, H.rowCm, true, {
        gap: 0.8,
        justify: FlexJustify.Start,
        align: FlexAlign.Center,
      })
      makeIcon(row, "HelpIcon", line.icon, H.iconCm, H.icon)
      makeText(row, "HelpText", line.text, "Body", H.textScale, textW, H.rowCm, {
        align: HorizontalAlignment.Left,
        wrap: true,
        color: i === 0 ? THEME.text.primary : TEXT_SECONDARY,
      })
    })
  }

  setOpen(open: boolean): void {
    if (open && !this.wantOpen) this.openedAt = getTime()
    this.wantOpen = open
    if (this.ready) this.sceneObject.enabled = open
  }

  isOpen(): boolean {
    return this.wantOpen
  }

  getHeightCm(): number {
    return this.heightCm
  }

  /** The four help lines as shown (test helper). */
  getLines(): string[] {
    return HELP_LINES.map((l) => l.text)
  }

  /** Presses HelpCloseButton's action (test helper). */
  debugClose(): void {
    this._onClose.invoke()
  }
}

/** Creates the closed "HelpCard" under the desk at THEME.help.anchorFromDeskCm. */
export function createHelpCard(desk: SceneObject): MemoraHelpUI {
  const so = global.scene.createSceneObject("HelpCard")
  so.setParent(desk)
  const a = THEME.help.anchorFromDeskCm
  so.getTransform().setLocalPosition(new vec3(a[0], a[1], a[2]))
  const ui = so.createComponent(MemoraHelpUI.getTypeName()) as MemoraHelpUI
  ui.configure()
  return ui
}
