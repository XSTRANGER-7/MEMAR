// MEMAR — where a panel opens so it fits the narrow SPECS view.
//
// The SPECS view is narrow (about 38° wide in the Lens Studio Preview). A 27 cm card placed
// beside an object at desk distance starts ~13° off-centre and needs ~18° of width, so it was
// mostly out of view. This places the card next to the object's centre line, on the side
// toward the middle of the view, so it opens fully in view while the object's badge stays
// visible (you still see the dot drop when you pinch Done).
//
// Rules:
//   - Distance: in front of the object's hit box (closer than it), so a pinch on a card button
//     never lands on the object behind it; clamped to a comfortable 40–75 cm.
//   - Size: scaled with distance so the card always looks the size it would at REF_DISTANCE_CM.
//   - Side: toward the middle of the user's current view (right of the object when it's centred).
//   - Height: a little above the object's line of sight; kept clear of the desk strip.
// Pure geometry: no scene access. Lens camera looks down -Z; yaw > 0 = to the right.

import {faceToward} from "./MemoraDetection"

const DEG = Math.PI / 180
/**
 * The card keeps the angular size it has at this distance. Measured in Preview: the view is
 * ~37° wide; at 115 cm the card (with VISUAL_WIDTH_FACTOR) fits ~2°–17.5° beside the object's
 * centre line, so it opens fully in view while you look at the object.
 */
const REF_DISTANCE_CM = 115
/** Panels draw ~15% wider than their nominal width (button rims, plate margin); measured in Preview. */
const VISUAL_WIDTH_FACTOR = 1.15
/** Gap between the object's centre line and the card's near edge (clears the object's badge). */
const GAP_DEG = 1.0
/** Lift above the object's line of sight. */
const LIFT_DEG = 2.5
/** Near the desk strip the card stays at least this high, so the strip and its hint never cover its footer. */
const STRIP_MIN_PITCH_DEG = 1.0
const STRIP_HALF_WIDTH_DEG = 22
const MIN_PITCH_DEG = -14
const MAX_PITCH_DEG = 6
const MIN_DIST_CM = 40
/**
 * Arm's reach. Measured in Preview: a card at 64 cm takes pinches, one at 75 cm doesn't (too far
 * for a direct pinch, too near for the far-pointing ray), so cards for distant things (door,
 * fridge, wallet) open within reach in front of them instead of out by the object.
 */
const MAX_DIST_CM = 62
/** Stay this far in front of the object's hit box. */
const STANDOFF_CM = 5
/** An object this far right of the view centre gets its card on its left instead. */
const FLIP_DEG = 3
/** Half of the usable view (Preview measures ~37° x ~43°), with a small safety margin. */
const VIEW_HALF_WIDTH_DEG = 17.5
const VIEW_HALF_HEIGHT_DEG = 19

export interface Placement {
  /** Bottom-centre position (panels pivot at their bottom-centre). */
  pos: vec3
  rot: quat
  scale: number
}

function yawOf(d: vec3): number {
  return Math.atan2(d.x, -d.z)
}

function pitchOf(d: vec3): number {
  return Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z))
}

function direction(yaw: number, pitch: number): vec3 {
  const cp = Math.cos(pitch)
  return new vec3(Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp)
}

function wrap(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

/**
 * @param eye       camera world position
 * @param viewDir   camera viewing direction (where the user is looking)
 * @param target    object hit-box centre (world)
 * @param radiusCm  about half the object's biggest side
 * @param widthCm   panel width at scale 1
 * @param heightCm  panel height at scale 1 (use the tallest view it can show)
 * @param strip     world position of the desk strip to keep clear of (optional)
 */
export function panelPlacement(
  eye: vec3,
  viewDir: vec3,
  target: vec3,
  radiusCm: number,
  widthCm: number,
  heightCm: number,
  strip?: vec3,
): Placement {
  const to = target.sub(eye)
  const dist = to.length
  const d = Math.min(MAX_DIST_CM, Math.max(MIN_DIST_CM, dist - radiusCm - STANDOFF_CM))
  const scale = Math.min(1, d / REF_DISTANCE_CM)
  const halfAngle = Math.atan((widthCm * VISUAL_WIDTH_FACTOR * scale) / 2 / d)
  const offset = halfAngle + GAP_DEG * DEG

  const objYaw = dist > 0.001 ? yawOf(to) : yawOf(viewDir)
  const objPitch = dist > 0.001 ? pitchOf(to) : 0
  const fromCentre = wrap(objYaw - yawOf(viewDir))
  let yaw = fromCentre > FLIP_DEG * DEG ? objYaw - offset : objYaw + offset

  let minPitch = MIN_PITCH_DEG * DEG
  if (strip) {
    const s = strip.sub(eye)
    if (Math.abs(wrap(yaw - yawOf(s))) < STRIP_HALF_WIDTH_DEG * DEG) minPitch = STRIP_MIN_PITCH_DEG * DEG
  }
  let pitch = Math.min(MAX_PITCH_DEG * DEG, Math.max(minPitch, objPitch + LIFT_DEG * DEG))

  // Always fully inside the current view: an object right at the edge of the view would
  // otherwise push its card half out of sight. Then the card may overlap the object a little.
  const viewYaw = yawOf(viewDir)
  const maxYaw = VIEW_HALF_WIDTH_DEG * DEG - halfAngle
  const relYaw = wrap(yaw - viewYaw)
  if (Math.abs(relYaw) > maxYaw) yaw = viewYaw + Math.sign(relYaw) * Math.max(0, maxYaw)
  const halfHeight = Math.atan((heightCm * scale) / 2 / d)
  const maxPitch = VIEW_HALF_HEIGHT_DEG * DEG - halfHeight
  const relPitch = pitch - pitchOf(viewDir)
  if (Math.abs(relPitch) > maxPitch) pitch = pitchOf(viewDir) + Math.sign(relPitch) * Math.max(0, maxPitch)

  const centre = eye.add(direction(yaw, pitch).uniformScale(d))
  const pos = centre.sub(new vec3(0, (heightCm * scale) / 2, 0))
  return {pos, rot: faceToward(centre, eye), scale}
}
