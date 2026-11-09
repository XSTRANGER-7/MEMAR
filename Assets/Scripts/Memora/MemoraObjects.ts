// MEMAR — the places and objects a memory can be linked to.
// In Lens Studio Preview the glasses can't recognise real things, so each object is a
// virtual stand-in placed in a zone (a desk, an entryway, a kitchen counter). Pinching a
// stand-in, or looking at it until the detector locks and confirming, is the "found it"
// moment. On real glasses a recognition adapter calls the same MemoraApp.selectObject().
//
// Coordinates: cm, right-handed, +Y up. The user starts at the origin looking down -Z, and
// the desk centre sits ~85 cm in front of them. Zone anchors are given relative to the desk centre;
// object offsets are relative to their zone anchor, in the zone's own frame (+Z of a zone
// points back towards the user, so a zone is turned by `yawDeg` around +Y to face them).

export type ZoneId = "desk" | "entryway" | "kitchen"
export type ObjectScale = "small" | "large"

export interface MemoraZoneDef {
  id: ZoneId
  name: string
  /** Zone surface centre relative to the desk centre, cm (desk-top height = 0). */
  anchorFromDeskCm: {x: number; y: number; z: number}
  /** Rotation around +Y, degrees, so the zone's front faces the user's start position. */
  yawDeg: number
  /** The stand-in surface the small things sit on. */
  surface: {name: string; w: number; d: number}
}

export interface MemoraObjectDef {
  id: string
  name: string
  /** Short label for the badge above the stand-in. */
  shortLabel: string
  zone: ZoneId
  scale: ObjectScale
  /** Stand-in centre relative to its zone anchor, cm, in the zone's frame (y = 0 on the surface). */
  offsetCm: {x: number; y: number; z: number}
  /** Rough real-world size of the stand-in, cm (width x depth x height). */
  sizeCm: {w: number; d: number; h: number}
  /** Things you take with you; the front door's "Before you leave" check lists their pending memories. */
  carry?: boolean
}

export const MEMORA_ZONES: MemoraZoneDef[] = [
  {id: "desk", name: "Desk", anchorFromDeskCm: {x: 0, y: 0, z: 0}, yawDeg: 0, surface: {name: "Desk", w: 120, d: 60}},
  {
    id: "entryway",
    name: "Entryway",
    anchorFromDeskCm: {x: -150, y: 0, z: 40},
    yawDeg: 73,
    surface: {name: "Console table", w: 80, d: 35},
  },
  {
    id: "kitchen",
    name: "Kitchen",
    anchorFromDeskCm: {x: 150, y: 0, z: 40},
    yawDeg: -73,
    surface: {name: "Counter", w: 90, d: 45},
  },
]

export const MEMORA_OBJECTS: MemoraObjectDef[] = [
  // Desk — the main moment.
  {id: "laptop", name: "Laptop", shortLabel: "Laptop", zone: "desk", scale: "large", offsetCm: {x: 0, y: 0, z: 0}, sizeCm: {w: 32, d: 22, h: 21}},
  {id: "keys", name: "Keys", shortLabel: "Keys", zone: "desk", scale: "small", offsetCm: {x: -23, y: 0, z: 11}, sizeCm: {w: 8, d: 5, h: 2}, carry: true},
  {id: "notebook", name: "Notebook", shortLabel: "Notebook", zone: "desk", scale: "small", offsetCm: {x: 29, y: 0, z: 8}, sizeCm: {w: 21, d: 15, h: 2}},
  {id: "bag", name: "Bag", shortLabel: "Bag", zone: "desk", scale: "large", offsetCm: {x: 62, y: -30, z: 6}, sizeCm: {w: 30, d: 15, h: 42}, carry: true},
  // Entryway — things you grab on the way out.
  {id: "door", name: "Front door", shortLabel: "Door", zone: "entryway", scale: "large", offsetCm: {x: -60, y: 25, z: -30}, sizeCm: {w: 90, d: 5, h: 200}},
  {id: "wallet", name: "Wallet", shortLabel: "Wallet", zone: "entryway", scale: "small", offsetCm: {x: 5, y: 0, z: 5}, sizeCm: {w: 11, d: 9, h: 2}, carry: true},
  {id: "umbrella", name: "Umbrella", shortLabel: "Umbrella", zone: "entryway", scale: "small", offsetCm: {x: 30, y: 0, z: 0}, sizeCm: {w: 6, d: 6, h: 30}, carry: true},
  // Kitchen — health and home.
  {id: "fridge", name: "Fridge", shortLabel: "Fridge", zone: "kitchen", scale: "large", offsetCm: {x: 70, y: 15, z: -30}, sizeCm: {w: 70, d: 65, h: 180}},
  {id: "medicine", name: "Medicine box", shortLabel: "Medicine", zone: "kitchen", scale: "small", offsetCm: {x: -10, y: 0, z: 5}, sizeCm: {w: 12, d: 7, h: 5}},
  {id: "bottle", name: "Water bottle", shortLabel: "Bottle", zone: "kitchen", scale: "small", offsetCm: {x: -35, y: 0, z: 0}, sizeCm: {w: 7, d: 7, h: 24}, carry: true},
]

/** Fallback bucket for memories that aren't tied to a specific thing. */
export const OTHER_OBJECT: MemoraObjectDef = {
  id: "other",
  name: "Other",
  shortLabel: "Other",
  zone: "desk",
  scale: "small",
  offsetCm: {x: 0, y: 0, z: 0},
  sizeCm: {w: 0, d: 0, h: 0},
}

const ALL = [...MEMORA_OBJECTS, OTHER_OBJECT]

export function findObject(id: string): MemoraObjectDef | undefined {
  return ALL.find((o) => o.id === id)
}

export function isKnownObject(id: string): boolean {
  return findObject(id) !== undefined
}

export function allObjectIds(): string[] {
  return ALL.map((o) => o.id)
}

export function findZone(id: string): MemoraZoneDef | undefined {
  return MEMORA_ZONES.find((z) => z.id === id)
}

/** Stand-in objects placed in a zone (never includes the "other" bucket). */
export function objectsInZone(zoneId: string): MemoraObjectDef[] {
  return MEMORA_OBJECTS.filter((o) => o.zone === zoneId)
}

/**
 * Where an object sits relative to the desk centre, cm: its zone anchor plus its offset
 * turned by the zone's yaw. UI scripts add the desk centre's world position to this.
 */
export function objectPositionFromDeskCm(objectId: string): {x: number; y: number; z: number} | undefined {
  const o = findObject(objectId)
  if (!o || o.id === OTHER_OBJECT.id) return undefined
  const z = findZone(o.zone)!
  const yaw = (z.yawDeg * Math.PI) / 180
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  // Rotation around +Y: x' = x cos + z sin, z' = -x sin + z cos.
  return {
    x: z.anchorFromDeskCm.x + o.offsetCm.x * c + o.offsetCm.z * s,
    y: z.anchorFromDeskCm.y + o.offsetCm.y,
    z: z.anchorFromDeskCm.z - o.offsetCm.x * s + o.offsetCm.z * c,
  }
}
