// MEMAR LEAF — criterion 5: delete with confirm. Details on the laptop's internship email →
// DeleteButton → CancelDeleteButton keeps it; DeleteButton → ConfirmDeleteButton removes it.
// Also pinches PriorityButton in the details view (medium → high), an extra check.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC05DeleteScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c05-delete", async (k) => {
      await k.press("Object-laptop")
      const reply = k.pendingId("laptop", "Reply to the internship email")
      expect(reply !== "", "internship email missing from the seed").toBe(true)

      await k.press(`MemoryRow-${reply}`)
      expect(k.card.debugView(), "details view").toBe("details")
      k.log(`details: ${k.renderedTexts("DetailsView").join(" / ")}`)

      await k.press("PriorityButton")
      expect(k.app.store.getMemoryById(reply)!.priority, "priority after PriorityButton (medium → high)").toBe("high")

      await k.press("DeleteButton")
      expect(k.card.debugConfirming() && k.visible("ConfirmDeleteButton") && k.visible("CancelDeleteButton"), "delete confirmation not shown").toBe(true)

      await k.press("CancelDeleteButton")
      expect(!!k.app.store.getMemoryById(reply), "Cancel (Keep) removed the memory").toBe(true)
      expect(k.card.debugConfirming(), "still confirming after Cancel").toBe(false)
      k.expectBadge("laptop", 2)

      await k.press("DeleteButton")
      await k.press("ConfirmDeleteButton")
      expect(k.app.store.getMemoryById(reply), "memory still exists after ConfirmDeleteButton").toBe(undefined)
      k.expectBadge("laptop", 1)
      expect(k.card.debugView(), "card back on the list").toBe("list")
      k.log(`after delete: rows ${k.drawnRowTitles().join(" | ")}; footer "${k.card.debugFooter()}"`)
    })
  }
}
