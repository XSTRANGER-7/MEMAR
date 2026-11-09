// MEMAR — the one place that says what each stand-in object and zone surface looks like.
// Plain module, no @component.
//
// Owns: per object id (same ids as MEMORA_OBJECTS in Memora/MemoraObjects.ts):
//   - the primitive parts that make the stand-in read as a laptop / keys / door / ...
//   - the pinch hit box, where the badge floats and where the card opens
// and per zone id (MEMORA_ZONES) the furniture parts of its surface.
// MemoraStandIn builds itself from this table; MemoraZones builds the surfaces;
// MemoraMain spawns a stand-in for any MEMORA_OBJECTS id that has no authored
// "Object-<id>" in the scene, inside that object's zone.
//
// To add an object (e.g. "earbuds"): add it to MEMORA_OBJECTS and add a spec here.
// Without a spec it still appears (as a plain pinchable box, FALLBACK_SPEC).
//
// Coordinates are cm in the object's zone frame (+Z towards the user). The
// object's resting point is MEMORA_OBJECTS[id].offsetCm (for floor-standing big
// things like the door and fridge that point is their centre). `centerCm` is the
// hit-box centre measured from the resting point; the Object-<id> SceneObject sits
// there and the builder offsets the parts back by -centerCm. Rotations: degrees.
// `cardCm` is where the card's BOTTOM-CENTRE goes, relative to the hit-box centre:
// beside the object, high enough that it never covers a neighbour or its badge.

export type MeshKey = "box" | "cylinder" | "torus" | "sphere" | "cone"
export type MaterialKey =
  | "wood"
  | "woodDark"
  | "laptopShell"
  | "laptopKeys"
  | "laptopScreen"
  | "brass"
  | "silver"
  | "accent"
  | "notebookCover"
  | "notebookPages"
  | "bagBody"
  | "bagTrim"
  | "glow"
  | "doorWood"
  | "doorFrame"
  | "fridgeBody"
  | "leather"
  | "umbrella"
  | "medicineBox"
  | "medicineCross"
  | "bottleBody"
  | "bottleCap"
  | "counterTop"
  | "counterBody"
  | "paper"
  | "reticle"

type V3 = [number, number, number]

export type StandInPart = {name: string; mesh: MeshKey; material: MaterialKey; pos: V3; scale: V3; rot?: V3; parent?: string}

export type StandInSpec = {
  /** Hit-box centre above the resting point. */
  centerCm: V3
  /** Pinch hit box size. */
  colliderCm: V3
  /** Badge position, relative to the hit-box centre. */
  badgeCm: V3
  /** Card bottom-centre, relative to the hit-box centre. */
  cardCm: V3
  /** Footprint of the selection glow disc. */
  glowCm: V3
  /** Height of the glow disc from the resting point (floor-standing things whose resting point is their centre). */
  glowY?: number
  /** Parts, positioned from the resting point. Hierarchy via `parent` (name of an earlier part). */
  parts: StandInPart[]
}

// Unit primitives (1 cm) and the prop materials live as project assets so they
// can be restyled in the Inspector; this table only references them.
const MESHES: Record<MeshKey, RenderMesh> = {
  box: requireAsset("../../Meshes/MemoraBox.mesh") as RenderMesh,
  cylinder: requireAsset("../../Meshes/MemoraCylinder.mesh") as RenderMesh,
  torus: requireAsset("../../Meshes/MemoraTorus.mesh") as RenderMesh,
  sphere: requireAsset("../../Meshes/MemoraSphere.mesh") as RenderMesh,
  cone: requireAsset("../../Meshes/MemoraCone.mesh") as RenderMesh,
}

const MATERIALS: Record<MaterialKey, Material> = {
  wood: requireAsset("../../Materials/MemoraWood.mat") as Material,
  woodDark: requireAsset("../../Materials/MemoraWoodDark.mat") as Material,
  laptopShell: requireAsset("../../Materials/MemoraLaptopShell.mat") as Material,
  laptopKeys: requireAsset("../../Materials/MemoraLaptopKeys.mat") as Material,
  laptopScreen: requireAsset("../../Materials/MemoraLaptopScreen.mat") as Material,
  brass: requireAsset("../../Materials/MemoraBrass.mat") as Material,
  silver: requireAsset("../../Materials/MemoraSilver.mat") as Material,
  accent: requireAsset("../../Materials/MemoraAccentOrange.mat") as Material,
  notebookCover: requireAsset("../../Materials/MemoraNotebookCover.mat") as Material,
  notebookPages: requireAsset("../../Materials/MemoraNotebookPages.mat") as Material,
  bagBody: requireAsset("../../Materials/MemoraBagBody.mat") as Material,
  bagTrim: requireAsset("../../Materials/MemoraBagTrim.mat") as Material,
  glow: requireAsset("../../Materials/MemoraSelectionGlow.mat") as Material,
  doorWood: requireAsset("../../Materials/MemoraDoorWood.mat") as Material,
  doorFrame: requireAsset("../../Materials/MemoraDoorFrame.mat") as Material,
  fridgeBody: requireAsset("../../Materials/MemoraFridgeBody.mat") as Material,
  leather: requireAsset("../../Materials/MemoraLeather.mat") as Material,
  umbrella: requireAsset("../../Materials/MemoraUmbrellaCanopy.mat") as Material,
  medicineBox: requireAsset("../../Materials/MemoraMedicineBox.mat") as Material,
  medicineCross: requireAsset("../../Materials/MemoraMedicineCross.mat") as Material,
  bottleBody: requireAsset("../../Materials/MemoraBottleBody.mat") as Material,
  bottleCap: requireAsset("../../Materials/MemoraBottleCap.mat") as Material,
  counterTop: requireAsset("../../Materials/MemoraCounterTop.mat") as Material,
  counterBody: requireAsset("../../Materials/MemoraCounterBody.mat") as Material,
  paper: requireAsset("../../Materials/MemoraPaper.mat") as Material,
  reticle: requireAsset("../../Materials/MemoraReticle.mat") as Material,
}

/** Shared material lookup for other 3D builders (e.g. the detection reticle). */
export function materialFor(key: MaterialKey): Material {
  return MATERIALS[key]
}

/** Spiral rings along a notebook spine. */
function spiral(count: number, x: number, z0: number, step: number): StandInPart[] {
  const parts: StandInPart[] = []
  for (let i = 0; i < count; i++)
    parts.push({name: `NotebookRing${i}`, mesh: "torus", material: "silver", pos: [x, 0.8, z0 + i * step], scale: [1.6, 1.2, 1.6], rot: [90, 0, 0]})
  return parts
}

export const STAND_IN_SPECS: Record<string, StandInSpec> = {
  // ── Desk ──────────────────────────────────────────────────────────────────
  laptop: {
    centerCm: [0, 11, -2.5],
    colliderCm: [33, 23, 28],
    badgeCm: [0, 15, -13.2],
    cardCm: [31, -2, -2],
    glowCm: [40, 0.2, 30],
    parts: [
      {name: "LaptopBase", mesh: "box", material: "laptopShell", pos: [0, 0.8, 0], scale: [32, 1.6, 22]},
      {name: "LaptopKeyboard", mesh: "box", material: "laptopKeys", pos: [0, 1.66, -3.2], scale: [27, 0.12, 9.5]},
      {name: "LaptopTrackpad", mesh: "box", material: "laptopKeys", pos: [0, 1.66, 5.6], scale: [10, 0.12, 6]},
      // Empty pivot (scale 0 = no mesh): the lid and display lean back with it.
      {name: "LaptopHinge", mesh: "box", material: "laptopShell", pos: [0, 1.6, -10.6], scale: [0, 0, 0], rot: [-14, 0, 0]},
      {name: "LaptopLid", parent: "LaptopHinge", mesh: "box", material: "laptopShell", pos: [0, 10.5, -0.4], scale: [32, 21, 0.8]},
      {name: "LaptopDisplay", parent: "LaptopHinge", mesh: "box", material: "laptopScreen", pos: [0, 10.9, 0.05], scale: [29.5, 18.4, 0.1]},
      {name: "LaptopCamera", parent: "LaptopHinge", mesh: "cylinder", material: "laptopKeys", pos: [0, 20.4, 0.05], scale: [0.5, 0.1, 0.5], rot: [90, 0, 0]},
    ],
  },
  keys: {
    centerCm: [0, 1.5, 1],
    colliderCm: [11, 4, 16],
    badgeCm: [0, 3.5, 0],
    cardCm: [-19, 1.5, -8],
    glowCm: [12, 0.2, 15],
    parts: [
      {name: "KeyRing", mesh: "torus", material: "silver", pos: [0, 0.25, 0], scale: [3.6, 1.2, 3.6]},
      {name: "KeyBrassHead", mesh: "cylinder", material: "brass", pos: [-1.2, 0.2, 2.6], scale: [2.4, 0.3, 2.4]},
      {name: "KeyBrassBlade", mesh: "box", material: "brass", pos: [-1.2, 0.2, 5.6], scale: [0.9, 0.25, 4.0]},
      {name: "KeyBrassTeeth", mesh: "box", material: "brass", pos: [-0.65, 0.2, 6.2], scale: [0.4, 0.25, 2.2]},
      {name: "KeySilverHead", mesh: "cylinder", material: "silver", pos: [1.6, 0.2, 2.2], scale: [2.2, 0.3, 2.2]},
      {name: "KeySilverBlade", mesh: "box", material: "silver", pos: [2.5, 0.2, 4.9], scale: [0.8, 0.25, 3.6], rot: [0, 20, 0]},
      {name: "KeyTag", mesh: "box", material: "accent", pos: [0.2, 0.5, -3.6], scale: [3.2, 0.6, 4.2]},
      {name: "KeyTagLabel", mesh: "box", material: "paper", pos: [0.2, 0.82, -3.8], scale: [2.2, 0.06, 2.6]},
      {name: "KeyTagHole", mesh: "cylinder", material: "silver", pos: [0.2, 0.5, -1.4], scale: [0.9, 0.7, 0.9]},
    ],
  },
  notebook: {
    centerCm: [0, 1, 0],
    colliderCm: [22, 4, 16],
    badgeCm: [0, 4.6, 0],
    cardCm: [25.5, 6, -4],
    glowCm: [26, 0.2, 19],
    parts: [
      {name: "NotebookBackCover", mesh: "box", material: "notebookCover", pos: [0, 0.125, 0], scale: [21, 0.25, 15]},
      {name: "NotebookPages", mesh: "box", material: "notebookPages", pos: [0.3, 0.8, 0], scale: [20.2, 1.1, 14.4]},
      {name: "NotebookFrontCover", mesh: "box", material: "notebookCover", pos: [0, 1.475, 0], scale: [21, 0.25, 15]},
      {name: "NotebookLabel", mesh: "box", material: "paper", pos: [1.5, 1.62, -3.5], scale: [7, 0.05, 3]},
      {name: "NotebookBand", mesh: "box", material: "accent", pos: [8, 0.85, 0], scale: [0.6, 1.8, 15.2]},
      ...spiral(9, -10.6, -6.4, 1.6),
    ],
  },
  bag: {
    centerCm: [0, 14, 0],
    colliderCm: [31, 29, 16],
    badgeCm: [0, 18, 0],
    cardCm: [0, 22, 0],
    glowCm: [36, 0.2, 20],
    parts: [
      {name: "BagBody", mesh: "box", material: "bagBody", pos: [0, 11, 0], scale: [30, 22, 14]},
      {name: "BagFlap", mesh: "box", material: "bagTrim", pos: [0, 17.5, 7.2], scale: [30.4, 9, 1]},
      {name: "BagPocket", mesh: "box", material: "bagTrim", pos: [0, 6, 7.3], scale: [18, 7, 0.8]},
      {name: "BagStrapLeft", mesh: "box", material: "leather", pos: [-8, 14, 7.8], scale: [2.4, 14, 0.4]},
      {name: "BagStrapRight", mesh: "box", material: "leather", pos: [8, 14, 7.8], scale: [2.4, 14, 0.4]},
      {name: "BagBuckleLeft", mesh: "box", material: "silver", pos: [-8, 9.5, 8.1], scale: [2.8, 1.6, 0.3]},
      {name: "BagBuckleRight", mesh: "box", material: "silver", pos: [8, 9.5, 8.1], scale: [2.8, 1.6, 0.3]},
      {name: "BagHandle", mesh: "torus", material: "leather", pos: [0, 22, 0], scale: [12, 3, 12], rot: [90, 0, 0]},
    ],
  },
  // ── Entryway ──────────────────────────────────────────────────────────────
  door: {
    centerCm: [0, 0, 0],
    colliderCm: [100, 206, 10],
    badgeCm: [0, 112, 0],
    cardCm: [66, -10, 2],
    glowCm: [96, 0.2, 14],
    glowY: -99.6,
    parts: [
      {name: "DoorSlab", mesh: "box", material: "doorWood", pos: [0, 0, 0], scale: [90, 200, 4]},
      {name: "DoorPanelTop", mesh: "box", material: "doorFrame", pos: [0, 47, 2.2], scale: [68, 76, 0.5]},
      {name: "DoorPanelBottom", mesh: "box", material: "doorFrame", pos: [0, -50, 2.2], scale: [68, 76, 0.5]},
      {name: "DoorJambLeft", mesh: "box", material: "doorFrame", pos: [-48, 3, 0], scale: [6, 206, 8]},
      {name: "DoorJambRight", mesh: "box", material: "doorFrame", pos: [48, 3, 0], scale: [6, 206, 8]},
      {name: "DoorHeader", mesh: "box", material: "doorFrame", pos: [0, 103, 0], scale: [102, 6, 8]},
      {name: "DoorRose", mesh: "cylinder", material: "silver", pos: [36, -2, 2.6], scale: [5, 1.2, 5], rot: [90, 0, 0]},
      {name: "DoorLever", mesh: "box", material: "silver", pos: [31, -2, 4.1], scale: [12, 1.8, 1.8]},
      {name: "DoorLock", mesh: "cylinder", material: "brass", pos: [36, 8, 2.6], scale: [3, 1, 3], rot: [90, 0, 0]},
      {name: "DoorMat", mesh: "box", material: "bagBody", pos: [0, -99.5, 32], scale: [80, 1, 50]},
    ],
  },
  wallet: {
    centerCm: [0, 1.5, 0],
    colliderCm: [14, 5, 12],
    badgeCm: [0, 4.5, 0],
    cardCm: [-2, 9, -10],
    glowCm: [16, 0.2, 13],
    parts: [
      {name: "WalletBody", mesh: "box", material: "leather", pos: [0, 0.9, 0], scale: [11, 1.8, 9]},
      {name: "WalletCard", mesh: "box", material: "notebookCover", pos: [1.2, 1.3, -2.2], scale: [8.5, 1.0, 5.4], rot: [0, 8, 0]},
      {name: "WalletStitch", mesh: "box", material: "paper", pos: [0, 1.82, 4.1], scale: [10.4, 0.08, 0.25]},
      {name: "WalletSnap", mesh: "cylinder", material: "silver", pos: [3.6, 1.9, 2.2], scale: [1.3, 0.25, 1.3]},
    ],
  },
  umbrella: {
    centerCm: [0, 16, 0],
    colliderCm: [9, 32, 9],
    badgeCm: [0, 20, 0],
    cardCm: [18, -6, 0],
    glowCm: [12, 0.2, 12],
    parts: [
      {name: "UmbrellaCanopy", mesh: "cone", material: "umbrella", pos: [0, 13, 0], scale: [5.5, 22, 5.5], rot: [180, 0, 0]},
      {name: "UmbrellaBand", mesh: "cylinder", material: "leather", pos: [0, 15, 0], scale: [3.4, 1.2, 3.4]},
      {name: "UmbrellaTip", mesh: "cylinder", material: "silver", pos: [0, 1, 0], scale: [0.7, 2, 0.7]},
      {name: "UmbrellaShaft", mesh: "cylinder", material: "silver", pos: [0, 26, 0], scale: [0.9, 4, 0.9]},
      {name: "UmbrellaHandle", mesh: "torus", material: "leather", pos: [1.7, 29.4, 0], scale: [4, 1.6, 4], rot: [90, 0, 0]},
    ],
  },
  // ── Kitchen ───────────────────────────────────────────────────────────────
  fridge: {
    centerCm: [0, 0, 0],
    colliderCm: [72, 182, 66],
    badgeCm: [0, 96, 30],
    cardCm: [-50, -1, 0],
    glowCm: [76, 0.2, 70],
    glowY: -89.8,
    parts: [
      {name: "FridgeBody", mesh: "box", material: "fridgeBody", pos: [0, 0, -1.5], scale: [70, 180, 62]},
      {name: "FridgeFreezerDoor", mesh: "box", material: "fridgeBody", pos: [0, 59.5, 30.5], scale: [69, 58, 3]},
      {name: "FridgeGap", mesh: "box", material: "counterBody", pos: [0, 30, 31], scale: [70, 1, 1]},
      {name: "FridgeMainDoor", mesh: "box", material: "fridgeBody", pos: [0, -30, 30.5], scale: [69, 118, 3]},
      {name: "FridgeFreezerHandle", mesh: "box", material: "silver", pos: [28, 52, 34], scale: [2.4, 30, 3]},
      {name: "FridgeMainHandle", mesh: "box", material: "silver", pos: [28, 4, 34], scale: [2.4, 50, 3]},
      {name: "FridgeKickPlate", mesh: "box", material: "counterBody", pos: [0, -86, 30], scale: [66, 8, 1]},
      {name: "FridgeNote", mesh: "box", material: "paper", pos: [-15, 8, 32.2], scale: [10, 12, 0.3]},
      {name: "FridgeMagnet", mesh: "cylinder", material: "accent", pos: [-15, 13, 32.5], scale: [2, 0.6, 2], rot: [90, 0, 0]},
    ],
  },
  medicine: {
    centerCm: [0, 2.5, 0],
    colliderCm: [14, 7, 9],
    badgeCm: [0, 6, 0],
    cardCm: [0, 9.5, -10],
    glowCm: [16, 0.2, 11],
    parts: [
      {name: "MedicineBox", mesh: "box", material: "medicineBox", pos: [0, 2.5, 0], scale: [12, 5, 7]},
      {name: "MedicineStripe", mesh: "box", material: "medicineCross", pos: [0, 0.6, 0], scale: [12.1, 0.8, 7.1]},
      {name: "MedicineCrossV", mesh: "box", material: "medicineCross", pos: [0, 2.8, 3.55], scale: [1.2, 3.4, 0.2]},
      {name: "MedicineCrossH", mesh: "box", material: "medicineCross", pos: [0, 2.8, 3.55], scale: [3.4, 1.2, 0.2]},
      {name: "MedicineTopCrossV", mesh: "box", material: "medicineCross", pos: [0, 5.03, 0], scale: [1.5, 0.08, 4.5]},
      {name: "MedicineTopCrossH", mesh: "box", material: "medicineCross", pos: [0, 5.03, 0], scale: [4.5, 0.08, 1.5]},
    ],
  },
  bottle: {
    centerCm: [0, 12, 0],
    colliderCm: [9, 25, 9],
    badgeCm: [0, 16, 0],
    cardCm: [-18.5, -10, 0],
    glowCm: [11, 0.2, 11],
    parts: [
      {name: "BottleBase", mesh: "cylinder", material: "bottleCap", pos: [0, 0.5, 0], scale: [7.1, 1, 7.1]},
      {name: "BottleBody", mesh: "cylinder", material: "bottleBody", pos: [0, 9.8, 0], scale: [7, 18, 7]},
      {name: "BottleLabel", mesh: "cylinder", material: "notebookPages", pos: [0, 9, 0], scale: [7.15, 6, 7.15]},
      {name: "BottleShoulder", mesh: "sphere", material: "bottleBody", pos: [0, 18.8, 0], scale: [7, 4, 7]},
      {name: "BottleCap", mesh: "cylinder", material: "bottleCap", pos: [0, 22.2, 0], scale: [3.6, 3.6, 3.6]},
    ],
  },
}

/** Plain box used when an object id has no spec yet, so a new id still shows up and is pinchable. */
export const FALLBACK_SPEC: StandInSpec = {
  centerCm: [0, 5, 0],
  colliderCm: [12, 10, 12],
  badgeCm: [0, 9, 0],
  cardCm: [19, 0, 0],
  glowCm: [16, 0.2, 16],
  parts: [{name: "PlaceholderBox", mesh: "box", material: "accent", pos: [0, 5, 0], scale: [10, 10, 10]}],
}

export function specFor(objectId: string): StandInSpec {
  return STAND_IN_SPECS[objectId] ?? FALLBACK_SPEC
}

/** Zone surface furniture (zone frame, surface top at y = 0, user towards +Z). The desk itself is authored in the scene. */
export const ZONE_FURNITURE: Record<string, {labelCm: V3; parts: StandInPart[]}> = {
  entryway: {
    labelCm: [0, -2.4, 18.4],
    parts: [
      {name: "ConsoleTop", mesh: "box", material: "wood", pos: [0, -1.5, 0], scale: [80, 3, 35]},
      {name: "ConsoleShelf", mesh: "box", material: "wood", pos: [0, -58, 0], scale: [72, 2, 29]},
      {name: "ConsoleLegFL", mesh: "box", material: "woodDark", pos: [-36, -39, 14], scale: [3.5, 72, 3.5]},
      {name: "ConsoleLegFR", mesh: "box", material: "woodDark", pos: [36, -39, 14], scale: [3.5, 72, 3.5]},
      {name: "ConsoleLegBL", mesh: "box", material: "woodDark", pos: [-36, -39, -14], scale: [3.5, 72, 3.5]},
      {name: "ConsoleLegBR", mesh: "box", material: "woodDark", pos: [36, -39, -14], scale: [3.5, 72, 3.5]},
    ],
  },
  kitchen: {
    // The counter ends where the fridge (offset x 70, 70 wide) begins.
    labelCm: [-5, -2.4, 23.6],
    parts: [
      {name: "CounterTop", mesh: "box", material: "counterTop", pos: [-5, -2, 0], scale: [80, 4, 46]},
      {name: "CounterCabinet", mesh: "box", material: "counterBody", pos: [-5, -39.5, -1], scale: [76, 71, 42]},
      {name: "CounterDoorLeft", mesh: "box", material: "fridgeBody", pos: [-24, -40, 20.6], scale: [36, 60, 1]},
      {name: "CounterDoorRight", mesh: "box", material: "fridgeBody", pos: [14, -40, 20.6], scale: [36, 60, 1]},
      {name: "CounterHandleLeft", mesh: "box", material: "silver", pos: [-10, -14, 21.6], scale: [6, 1.2, 1.4]},
      {name: "CounterHandleRight", mesh: "box", material: "silver", pos: [0, -14, 21.6], scale: [6, 1.2, 1.4]},
    ],
  },
}

export function toVec3(v: V3): vec3 {
  return new vec3(v[0], v[1], v[2])
}

const DEG = Math.PI / 180

/** Builds `parts` under `root` (part names unique per call). Returns them by name. */
export function buildParts(root: SceneObject, parts: StandInPart[]): Record<string, SceneObject> {
  const byName: Record<string, SceneObject> = {}
  for (const p of parts) {
    const so = global.scene.createSceneObject(p.name)
    const parent = p.parent ? byName[p.parent] : undefined
    so.setParent(parent ?? root)
    const t = so.getTransform()
    t.setLocalPosition(toVec3(p.pos))
    if (p.rot) t.setLocalRotation(quat.fromEulerAngles(p.rot[0] * DEG, p.rot[1] * DEG, p.rot[2] * DEG))
    const isPivot = p.scale[0] === 0 && p.scale[1] === 0 && p.scale[2] === 0
    if (!isPivot) addMesh(so, p.mesh, p.material, toVec3(p.scale))
    byName[p.name] = so
  }
  return byName
}

/**
 * Builds the visible parts under a new "Visual" child of `root` (offset by
 * -centerCm so parts sit on the resting point). Returns the Visual root and the
 * selection glow (disabled).
 */
export function buildStandInVisual(root: SceneObject, spec: StandInSpec): {visual: SceneObject; glow: SceneObject} {
  const visual = global.scene.createSceneObject("Visual")
  visual.setParent(root)
  visual.getTransform().setLocalPosition(toVec3(spec.centerCm).uniformScale(-1))
  buildParts(visual, spec.parts)

  const glow = global.scene.createSceneObject("SelectionGlow")
  glow.setParent(visual)
  glow.getTransform().setLocalPosition(new vec3(0, spec.glowY ?? 0.1, 0))
  addMesh(glow, "cylinder", "glow", toVec3(spec.glowCm))
  glow.enabled = false
  return {visual, glow}
}

/** Mesh on a scaled leaf child, so the part's own transform stays unscaled for its children. */
export function addMesh(so: SceneObject, mesh: MeshKey, material: MaterialKey, scale: vec3): RenderMeshVisual {
  const leaf = global.scene.createSceneObject(`${so.name}Mesh`)
  leaf.setParent(so)
  leaf.getTransform().setLocalScale(scale)
  const rmv = leaf.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  rmv.mesh = MESHES[mesh]
  rmv.mainMaterial = MATERIALS[material]
  return rmv
}
