// MEMAR LEAF — criterion 6: zones. Entryway/kitchen badges from the seed, door and bottle
// hidden, the stand-ins sit in their zones, ZoneHint-entryway "Entryway · 2", ZoneHint-kitchen "Kitchen · 2".
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, hasAncestorWithName} from "Leaf.lspkg/Utils/common/Utils"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC06ZonesScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c06-zones", async (k) => {
      const want: [string, string, number][] = [
        ["wallet", "Zone-entryway", 1],
        ["umbrella", "Zone-entryway", 1],
        ["door", "Zone-entryway", 0],
        ["medicine", "Zone-kitchen", 1],
        ["fridge", "Zone-kitchen", 1],
        ["bottle", "Zone-kitchen", 0],
      ]
      for (const [id, zone, n] of want) {
        const so = findSceneObjectByName(`Object-${id}`)
        expect(!!so && so.isEnabledInHierarchy, `Object-${id} missing`).toBe(true)
        expect(hasAncestorWithName(so!, zone), `Object-${id} is not under ${zone}`).toBe(true)
        k.expectBadge(id, n)
      }
      const entry = k.strip.getZoneHintText("entryway")
      const kitchen = k.strip.getZoneHintText("kitchen")
      k.log(`ZoneHint-entryway "${entry}", ZoneHint-kitchen "${kitchen}"; drawn: ${k.renderedTexts("ZoneHint-entryway").join("/")} | ${k.renderedTexts("ZoneHint-kitchen").join("/")}`)
      expect(entry.indexOf("Entryway · 2") >= 0 && k.visible("ZoneHint-entryway"), `ZoneHint-entryway "${entry}"`).toBe(true)
      expect(kitchen.indexOf("Kitchen · 2") >= 0 && k.visible("ZoneHint-kitchen"), `ZoneHint-kitchen "${kitchen}"`).toBe(true)
      k.log(
        `badges: wallet ${k.badge("wallet")}, umbrella ${k.badge("umbrella")}, medicine ${k.badge("medicine")}, fridge ${k.badge("fridge")}, ` +
          `door ${k.visible("Badge-door") ? k.badge("door") : "hidden"}, bottle ${k.visible("Badge-bottle") ? k.badge("bottle") : "hidden"}`,
      )
    })
  }
}
