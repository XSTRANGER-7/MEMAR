// MEMAR LEAF — criterion 4: add from preset with a quick double pinch.
// Object-notebook → AddButton → Preset-Review meeting action items pinched twice back to back →
// the preset handler runs twice, the engine keeps one memory, Badge-notebook shows 1.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {runMemoraScenario} from "./MemoraLeafKit"

const PRESET = "Preset-Review meeting action items"

@component
export class MemoraC04PresetScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c04-preset", async (k) => {
      await k.press("Object-notebook")
      expect(k.card.debugRowIds().length, "notebook should start empty").toBe(0)
      k.expectBadge("notebook", 0)
      k.log(`notebook card empty state: ${k.renderedTexts("EmptyState").join(" / ")}`)

      await k.press("AddButton")
      expect(k.card.debugView(), "quick-add list").toBe("presets")
      expect(k.visible(PRESET), `${PRESET} not shown`).toBe(true)

      // Count what reaches the card's preset handler (after its input lock), to show both pinches landed.
      let handled = 0
      const unsubscribe = k.card.onPresetSelected.add(() => handled++)
      const gap = await k.doublePinch(PRESET)
      unsubscribe()
      k.log(`preset handler ran ${handled}x; notebook pending right after: ${k.pendingTitles("notebook").join(" | ")}`)
      expect(handled, "both pinches should reach the preset handler").toBe(2)
      expect(gap < 1.5, `second pinch ${gap.toFixed(2)} s after the first is outside the 1.5 s duplicate window`).toBe(true)

      await sleep(1500) // the quick-add list stays up 0.7 s after a save
      expect(k.pendingTitles("notebook").join("|"), "notebook memories after a double pinch").toBe("Review meeting action items")
      k.expectBadge("notebook", 1)
      expect(k.card.debugView(), "card should return to the list").toBe("list")
      k.log(`after: rows ${k.drawnRowTitles().join(" | ")}; Badge-notebook ${k.badge("notebook")}`)
    })
  }
}
