// MEMAR — the UI style sheet + shared building blocks for every MEMAR panel
// (MemoraCardUI, MemoraBadgeUI, MemoraTodayStripUI). Plain module, no @component.
//
// Owns: THEME (every colour, size and text scale the panels use — restyle here,
// in one place), the type scale, and small factories that compose UIKit
// primitives (FlexLayout / FlexItem / BackPlate / Button / ElementContent) the
// same way in every panel. Fonts: the panels use the SnapOS system font; set
// THEME.font to a Font asset to switch every label at once.
// Must NOT: hold app state or talk to the memory engine. UI modules only.
//
// Layout rule used everywhere ("slot pattern"): a FlexLayout only positions its
// direct FlexItem children, and it does not re-run discovery when a child is
// enabled/disabled. So every layout child is an always-enabled *slot*; anything
// that appears/disappears (a button, an empty-state label) lives INSIDE a slot
// and is toggled there. Layout positions never go stale.

import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {InteractionPlane} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractionPlane/InteractionPlane"
import {TargetingMode} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"
import {IMAGE_MATERIAL_ASSET} from "SpectaclesUIKit.lspkg/Scripts/Utility/Assets"

export type TextRole =
  | "Title1"
  | "Title2"
  | "HeadlineXL"
  | "Headline1"
  | "Headline2"
  | "Subheadline"
  | "Button"
  | "Callout"
  | "Body"
  | "Caption"

// ── THEME: the single place to restyle MEMAR ────────────────────────────────
// Specs is additive: black renders as transparent and very dark reads as faint,
// so surfaces stay mid-tone and text stays light.
export const THEME = {
  /** Multiplier on every text size in every panel. */
  textScale: 1.0,
  /** Optional Font asset for every label (undefined = system font). */
  font: undefined as Font | undefined,
  text: {
    primary: new vec4(1, 1, 1, 1),
    secondary: new vec4(0.88, 0.92, 1, 1),
  },
  card: {
    widthCm: 27,
    padCm: 1.1,
    gapCm: 0.7,
    plate: new vec4(0.27, 0.33, 0.43, 0.96),
    /** Neutral buttons (rows, Back, Close, Keep) = plate lightened by this much. */
    neutralLift: 0.13,
    primary: new vec4(0.22, 0.47, 0.8, 1.0),
    done: new vec4(0.2, 0.62, 0.42, 1.0),
    danger: new vec4(0.78, 0.3, 0.3, 1.0),
    iconCm: 2.2,
    headerCm: 5.0,
    footerCm: 4.6,
    rowCm: 6.4,
    rowGapCm: 0.6,
    doneButtonCm: 5.2,
    presetCm: 4.8,
    presetGapCm: 0.45,
    captionCm: 1.8,
    /** Row titles: HeadlineXL (em 1.41 cm) x this; cap height ≈ 0.7 em ≈ 1.13 cm. */
    rowTitleScale: 1.15,
    /** Open animation (scale-in) and Done animation (row fade-out), seconds. */
    openSeconds: 0.15,
    rowOutSeconds: 0.16,
  },
  /** Row subtitle colour by memory priority. */
  priority: {
    high: new vec4(1.0, 0.66, 0.5, 1),
    medium: new vec4(1.0, 0.87, 0.5, 1),
    low: new vec4(0.76, 0.87, 1.0, 1),
  },
  /** Card footer status line by tone. */
  footer: {
    info: new vec4(0.88, 0.92, 1, 1),
    success: new vec4(0.62, 1.0, 0.72, 1),
    error: new vec4(1.0, 0.64, 0.58, 1),
  },
  /** Corner radius used by small pills and chips. */
  radiusCm: 0.9,
  badge: {
    diameterCm: 3.2,
    dot: new vec4(1.0, 0.47, 0.26, 1.0),
  },
  /** Look-to-detect + Scan (behaviour constants live here too, so tuning is one file). */
  detect: {
    chip: new vec4(0.2, 0.42, 0.68, 1),
    caption: new vec4(0.62, 0.92, 1, 1),
    chipWidthCm: 28,
    chipHeightCm: 6,
    /** Progress dots around the reticle's corner. */
    ringDots: 16,
    ringRadiusCm: 1.8,
    bracketMarginCm: 2,
    bracketThicknessCm: 0.35,
    /** The chip hides after the user has looked away this long. */
    chipLookAwaySeconds: 1.5,
    /** A chip opened by the test hook stays up this long without real gaze. */
    simulatedChipSeconds: 8,
    scanHalfAngleDeg: 25,
    scanTagSeconds: 3,
    sweepSeconds: 0.6,
  },
  /** Done archive panel. Anchor = bottom-centre, desk-local (left of the laptop, above the keys). */
  archive: {
    widthCm: 26,
    padCm: 1.0,
    gapCm: 0.6,
    headerCm: 4.8,
    footerCm: 4.4,
    rowCm: 4.8,
    rowGapCm: 0.45,
    closeCm: 4.6,
    restoreCm: 10,
    clearCm: 11,
    anchorFromDeskCm: [-31, 8, -6] as [number, number, number],
  },
  /** Pill labels: zone names, zone hints, first-run hint, scan tags. */
  label: {
    zone: {plate: new vec4(0.3, 0.38, 0.5, 0.95), text: new vec4(1, 1, 1, 1), role: "Subheadline" as TextRole},
    hint: {plate: new vec4(0.24, 0.42, 0.66, 0.95), text: new vec4(1, 1, 1, 1), role: "Subheadline" as TextRole},
    firstRun: {plate: new vec4(0.3, 0.38, 0.5, 0.9), text: new vec4(0.92, 0.95, 1, 1), role: "Body" as TextRole},
    scanTag: {plate: new vec4(0.22, 0.47, 0.8, 0.97), text: new vec4(1, 1, 1, 1), role: "Subheadline" as TextRole},
  },
  strip: {
    widthCm: 30,
    heightCm: 4.2,
    padCm: 0.7,
    gapCm: 0.5,
    /** Square icon buttons (Scan, Detect, Done list, Help). */
    buttonCm: 3.6,
    iconCm: 1.9,
    hintWidthCm: 25,
    /** Zone hints sit this far left/right of the strip centre, at the desk edge's ends. */
    zoneHintOffsetCm: 32,
    plate: new vec4(0.3, 0.38, 0.5, 0.95),
  },
  /** "Before you leave" note on the front door. Read from ~1.8 m, so its text is larger. */
  leave: {
    widthCm: 30,
    padCm: 1.2,
    headerCm: 3.8,
    /** Each line's slot height (includes its spacing). */
    lineCm: 2.7,
    maxLines: 4,
    maxChars: 42,
    textScale: 1.35,
    plate: new vec4(0.3, 0.38, 0.5, 0.94),
    success: new vec4(0.62, 1.0, 0.72, 1),
    /** Top-centre in the entryway zone's frame: on the door's right half, just under the handle, about eye height. */
    anchorCm: [-32, 19, -26.6] as [number, number, number],
  },
  /**
   * Help card ("?" on the today strip). Bottom-centre, desk-local: above and behind the laptop,
   * the one spot that is inside the ~32° x 37° view from the start pose and over no stand-in
   * (beside the desk it would open out of view). Read from ~1.4 m, so its text is larger.
   */
  help: {
    widthCm: 34,
    padCm: 0.9,
    gapCm: 0.5,
    headerCm: 4.4,
    rowCm: 3.4,
    rowGapCm: 0.35,
    iconCm: 2.2,
    closeCm: 4.2,
    textScale: 1.3,
    icon: new vec4(0.62, 0.92, 1, 1),
    anchorFromDeskCm: [0, 34, -55] as [number, number, number],
  },
}

// ── Typography ───────────────────────────────────────────────────────────────
// Text.size is the em-square height: em cm = size / 43.886. Sizes are the Snap
// Specs type scale (calibrated at 110 cm). MEMAR panels sit 50–85 cm away, so
// the same numbers read ~1.3–2x larger than the system default, which is what
// the brief asks for (large, glanceable text). THEME.textScale scales them all.

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500},
}

export function roleSize(role: TextRole, scale: number = 1): number {
  return TYPE_SCALE[role].size * scale * THEME.textScale
}

export function applyTextRole(t: Text, role: TextRole, scale: number = 1): void {
  t.size = roleSize(role, scale)
  t.weight = TYPE_SCALE[role].weight
}

// ── Colour helpers ───────────────────────────────────────────────────────────
export const TEXT_PRIMARY = THEME.text.primary
export const TEXT_SECONDARY = THEME.text.secondary

export function lighten(c: vec4, amount: number): vec4 {
  return new vec4(Math.min(1, c.x + amount), Math.min(1, c.y + amount), Math.min(1, c.z + amount), c.w)
}

export type ButtonTint = {base: vec4; hover: vec4; pressed: vec4}

export function tintFrom(base: vec4): ButtonTint {
  return {base, hover: lighten(base, 0.12), pressed: lighten(base, -0.08)}
}

// ── SceneObject + layout factories ───────────────────────────────────────────
export function makeObject(parent: SceneObject, name: string, localPos?: vec3): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  if (localPos) so.getTransform().setLocalPosition(localPos)
  return so
}

export type FlexOpts = {
  gap?: number
  padX?: number
  padY?: number
  justify?: FlexJustify
  align?: FlexAlign
}

/**
 * A FlexLayout container. `asItem` adds a FlexItem with a fixed size so the
 * container is itself laid out by its parent layout.
 */
export function makeFlex(
  parent: SceneObject,
  name: string,
  direction: FlexDirection,
  width: number,
  height: number,
  asItem: boolean,
  opts: FlexOpts = {},
): SceneObject {
  const so = makeObject(parent, name)
  const flex = so.createComponent(FlexLayout.getTypeName()) as FlexLayout
  flex.width = width
  flex.height = height
  flex.direction = direction
  if (direction === FlexDirection.Row) flex.columnGap = opts.gap ?? 0
  else flex.rowGap = opts.gap ?? 0
  flex.paddingLeft = opts.padX ?? 0
  flex.paddingRight = opts.padX ?? 0
  flex.paddingTop = opts.padY ?? 0
  flex.paddingBottom = opts.padY ?? 0
  flex.justifyContent = opts.justify ?? FlexJustify.Start
  flex.alignItems = opts.align ?? FlexAlign.Center
  if (asItem) sizeItem(so, width, height)
  return so
}

/** A fixed-size, always-enabled layout cell. Children sit at its centre. */
export function makeSlot(parent: SceneObject, name: string, width: number, height: number): SceneObject {
  const so = makeObject(parent, name)
  sizeItem(so, width, height)
  return so
}

function sizeItem(so: SceneObject, width: number, height: number): FlexItem {
  const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = width
  item.overrideHeight = height
  item.flexGrow = 0
  item.flexShrink = 0
  return item
}

export type TextOpts = {
  align?: HorizontalAlignment
  wrap?: boolean
  color?: vec4
  asItem?: boolean
  z?: number
}

/** Raw Component.Text with depth test on and a rect sized for its cell. */
export function makeText(
  parent: SceneObject,
  name: string,
  value: string,
  role: TextRole,
  scale: number,
  width: number,
  height: number,
  opts: TextOpts = {},
): Text {
  const so = makeObject(parent, name, opts.z !== undefined ? new vec3(0, 0, opts.z) : undefined)
  const t = so.createComponent("Component.Text") as Text
  t.text = value
  t.depthTest = true
  applyTextRole(t, role, scale)
  t.horizontalAlignment = opts.align ?? HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = opts.wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
  t.textFill.color = opts.color ?? TEXT_PRIMARY
  if (THEME.font) t.font = THEME.font
  if (opts.asItem !== false) sizeItem(so, width, height)
  return t
}

// ── Surfaces ─────────────────────────────────────────────────────────────────
/**
 * UIKit BackPlate tinted to a flat mid-tone colour (optionally fully rounded).
 * Decorative plates (solid = false: badges, labels, strip, notes) disable their
 * collider and drop the interaction plane after init, so they never block a pinch or a
 * hand ray aimed at the object behind them. Panels with buttons the user reads
 * (card, archive, help) stay solid so pinches don't pass through them.
 */
export function makePlate(host: SceneObject, size: vec2, color: vec4, cornerRadius?: number, solid: boolean = false): BackPlate {
  const plate = host.createComponent(BackPlate.getTypeName()) as BackPlate
  plate.style = "simple"
  plate.size = size
  plate.onInitialized.add(() => {
    const rr = host.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle | null
    if (rr) {
      rr.gradient = false
      rr.backgroundColor = color
      if (cornerRadius !== undefined) rr.cornerRadius = cornerRadius
    }
    removeInteractionPlane(host)
    // Disabled, not destroyed: BackPlate re-shapes its collider whenever the plate is resized.
    if (!solid) for (const c of host.getComponents("Physics.ColliderComponent")) c.enabled = false
  })
  return plate
}

/** The near-field interaction plane switches hands to poke targeting near the panel; MEMAR buttons are pinched. */
function removeInteractionPlane(host: SceneObject): void {
  for (const c of host.getComponents(InteractionPlane.getTypeName())) c.destroy()
  for (let i = host.getChildrenCount() - 1; i >= 0; i--) {
    const child = host.getChild(i)
    if (child.name === "InteractionPlaneColliderRoot") child.destroy()
  }
}

// ── Buttons ──────────────────────────────────────────────────────────────────
/**
 * UIKit Button (SnapOS2 rectangle). Size is set before init. Call applyTint()
 * a few frames later: the theme style is applied after onInitialized fires and
 * would overwrite an earlier tint.
 */
export function makeButton(parent: SceneObject, name: string, width: number, height: number): Button {
  const so = makeObject(parent, name)
  const btn = so.createComponent(Button.getTypeName()) as Button
  btn.setVariant({theme: "SnapOS2", shape: "Rectangle", style: "PrimaryNeutral"})
  btn.size = new vec3(width, height, 1)
  // Pinch only (near or far). MEMAR panels sit beyond arm's reach, and with poke on, a
  // hand reaching for one header button can poke its neighbour on the way.
  btn.onInitialized.add(() => {
    btn.interactable.targetingMode = TargetingMode.Direct | TargetingMode.Indirect
  })
  return btn
}

/** Flat mid-tone face colours (additive display: the default faces are near-black). */
export function applyTint(btn: Button, tint: ButtonTint): void {
  const vis = btn.visual as RoundedRectangleVisual
  if (!vis) return
  vis.defaultBaseType = "Color"
  vis.hoveredBaseType = "Color"
  vis.triggeredBaseType = "Color"
  vis.baseDefaultColor = tint.base
  vis.baseHoveredColor = tint.hover
  vis.baseTriggeredColor = tint.pressed
  // The visual switches Gradient → Color on its next update but skips the colour
  // write on that same pass, so set the resting face colour directly once.
  const rr = btn.sceneObject.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle | null
  if (rr) rr.backgroundColor = tint.base
}

/** Icon and/or short label composed by ElementContent as the button's only face content. */
export function addButtonContent(btn: Button, icon: Texture | null, label: string, scale: number, iconSize: number): void {
  const ec = btn.sceneObject.createComponent(ElementContent.getTypeName()) as ElementContent
  if (icon) {
    ec.leadingIcon = icon
    ec.leadingIconSize = iconSize
  }
  ec.text = label
  ec.textSize = roleSize("Headline2", scale)
  ec.spacing = 0.5
  ec.contentAlignment = "center"
}

/** Raw-Text label on a button face (for long, wrapping labels). Lifted in front of the face. */
export function addButtonLabel(
  btn: Button,
  value: string,
  role: TextRole,
  scale: number,
  width: number,
  height: number,
  align: HorizontalAlignment = HorizontalAlignment.Center,
): Text {
  return makeText(btn.sceneObject, "ButtonLabel", value, role, scale, width, height, {
    align,
    wrap: true,
    asItem: false,
    z: 0.08,
  })
}

/** A small tinted icon in a fixed layout cell (same Image setup UIKit's ElementContent uses). */
export function makeIcon(parent: SceneObject, name: string, icon: Texture, sizeCm: number, tint: vec4): Image {
  const slot = makeSlot(parent, name, sizeCm, sizeCm)
  const so = makeObject(slot, `${name}Image`)
  const image = so.createComponent("Component.Image") as Image
  image.mainMaterial = IMAGE_MATERIAL_ASSET.clone()
  image.mainPass.baseTex = icon
  image.mainPass.baseColor = tint
  image.stretchMode = StretchMode.Stretch
  so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
  return image
}
