// MEMAR LEAF — criterion 3: Done + Undo. DoneButton on the report → row gone, laptop badge 1,
// TodayStrip changes; UndoButton → everything back.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario, SEED_STRIP} from "./MemoraLeafKit"

@component
export class MemoraC03DoneUndoScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c03-done-undo", async (k) => {
      await k.press("Object-laptop")
      const report = k.pendingId("laptop", "Submit the project report")
      expect(report !== "", "report memory missing from the seed").toBe(true)
      expect(k.strip.getText(), "TodayStrip before Done").toBe(SEED_STRIP)

      await k.press(`DoneButton-${report}`, 900)
      expect(k.card.debugRowIds().indexOf(report), "report row still on the card").toBe(-1)
      expect(k.visible(`MemoryRow-${report}`), "MemoryRow of the report still drawn").toBe(false)
      k.expectBadge("laptop", 1)
      expect(k.strip.getText(), "TodayStrip after Done").toBe("7 pending · 2 due today")
      expect(k.visible("UndoButton"), "UndoButton not shown after Done").toBe(true)
      k.log(`after Done: rows ${k.drawnRowTitles().join(" | ")}; strip "${k.strip.getText()}"; footer "${k.card.debugFooter()}"`)

      await k.press("UndoButton")
      expect(k.card.debugRowIds()[0], "report did not come back first").toBe(report)
      expect(k.rowText(report, "RowTitle"), "report row title").toBe("Submit the project report")
      k.expectBadge("laptop", 2)
      expect(k.strip.getText(), "TodayStrip after Undo").toBe(SEED_STRIP)
      k.log(`after Undo: rows ${k.drawnRowTitles().join(" | ")}; strip "${k.strip.getText()}"`)
    })
  }
}
