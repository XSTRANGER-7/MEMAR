// MEMAR — builds the zones (Entryway, Kitchen, ...) from MEMORA_ZONES. Plain module.
//
// Owns: one "Zone-<id>" SceneObject per zone, placed relative to the authored Desk
// at the zone's anchorFromDeskCm and turned by its yawDeg so it faces the user's
// start position; the zone's surface furniture (MemoraStandInCatalog ZONE_FURNITURE)
// and its "ZoneLabel-<id>" on the surface front edge.
// The desk zone is the authored "Desk" itself (its furniture is in the scene).
// Must NOT: create stand-ins (MemoraMain spawns them into the zone roots) or read the store.

import {MEMORA_ZONES, MemoraZoneDef} from "../Memora/MemoraObjects"
import {createLabel} from "./MemoraLabelUI"
import {buildParts, toVec3, ZONE_FURNITURE} from "./MemoraStandInCatalog"
import {THEME} from "./MemoraThemeUI"

const DEG = Math.PI / 180

/** Zone roots by zone id; "desk" maps to the authored Desk. */
export function buildZones(desk: SceneObject): Record<string, SceneObject> {
  const roots: Record<string, SceneObject> = {}
  for (const zone of MEMORA_ZONES) {
    roots[zone.id] = zone.id === "desk" ? desk : buildZone(desk, zone)
  }
  return roots
}

function buildZone(desk: SceneObject, zone: MemoraZoneDef): SceneObject {
  const root = global.scene.createSceneObject(`Zone-${zone.id}`)
  root.setParent(desk)
  const t = root.getTransform()
  t.setLocalPosition(new vec3(zone.anchorFromDeskCm.x, zone.anchorFromDeskCm.y, zone.anchorFromDeskCm.z))
  t.setLocalRotation(quat.fromEulerAngles(0, zone.yawDeg * DEG, 0))

  const furniture = ZONE_FURNITURE[zone.id]
  if (furniture) {
    const surface = global.scene.createSceneObject("Surface")
    surface.setParent(root)
    buildParts(surface, furniture.parts)
    const label = createLabel(
      root,
      `ZoneLabel-${zone.id}`,
      toVec3(furniture.labelCm),
      zone.name,
      zone.name.length * 1.1 + 3,
      3.6,
      THEME.label.zone,
    )
    label.getSceneObject().getTransform().setLocalRotation(quat.fromEulerAngles(-12 * DEG, 0, 0))
  }
  return root
}
