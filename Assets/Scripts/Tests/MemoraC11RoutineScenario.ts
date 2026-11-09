// MEMAR LEAF — criterion 11: routine. Medicine card → Done on the daily "Take vitamin D after lunch" →
// toast "Done · back tomorrow …", badge stays 1, the row reads "Tomorrow … · Daily";
// UndoButton → the original is back with no duplicate (badge 1, one row).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario} from "./MemoraLeafKit"

const VITAMIN = "Take vitamin D after lunch"

@component
export class MemoraC11RoutineScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c11-routine", async (k) => {
      await k.press("Object-medicine")
      const vit = k.pendingId("medicine", VITAMIN)
      expect(vit !== "", "vitamin D missing from the seed").toBe(true)
      const meta0 = k.rowText(vit, "RowMeta")
      k.log(`before: row "${k.rowText(vit, "RowTitle")}" / "${meta0}"`)
      expect(meta0.indexOf("Daily") > 0, `vitamin D row meta "${meta0}"`).toBe(true)

      await k.press(`DoneButton-${vit}`, 900)
      const toast = k.card.debugFooter()
      expect(toast.indexOf("Done · back tomorrow") === 0, `toast "${toast}"`).toBe(true)
      k.expectBadge("medicine", 1)
      const ids = k.card.debugRowIds()
      expect(ids.length, "medicine rows after Done").toBe(1)
      const next = ids[0]
      expect(next !== vit, "the next occurrence should be a new memory").toBe(true)
      const meta1 = k.rowText(next, "RowMeta")
      k.log(`after Done: toast "${toast}"; row "${k.rowText(next, "RowTitle")}" / "${meta1}"`)
      expect(k.rowText(next, "RowTitle"), "next occurrence title").toBe(VITAMIN)
      expect(meta1.indexOf("Tomorrow") >= 0 && meta1.indexOf("Daily") > 0, `next row meta "${meta1}"`).toBe(true)

      await k.press("UndoButton")
      const vits = k.app.store.getPendingMemoriesByObject("medicine").filter((m) => m.title === VITAMIN)
      expect(vits.length, "vitamin D rows after Undo").toBe(1)
      expect(vits[0].id, "the original came back").toBe(vit)
      const leftover = k.app.store.getMemoryById(next)
      expect(!leftover || leftover.status !== "pending", "next occurrence left behind after Undo").toBe(true)
      k.expectBadge("medicine", 1)
      expect(k.card.debugRowIds().join(","), "medicine card rows after Undo").toBe(vit)
      k.log(`after Undo: row "${k.rowText(vit, "RowTitle")}" / "${k.rowText(vit, "RowMeta")}"`)
    })
  }
}
