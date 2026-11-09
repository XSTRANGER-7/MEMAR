// MEMAR LEAF — criterion 12: snooze. Laptop gets "Back up the thesis folder" (preset, no due date);
// its details → SnoozeButton → due ≈ now + 1 h, toast "Snoozed to …", and the card re-sorts
// (it moves above the undated internship email). All steps are real pinches.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC12SnoozeScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c12-snooze", async (k) => {
      await k.press("Object-laptop")
      await k.press("AddButton")
      await k.press("Preset-Back up the thesis folder", 1500) // quick-add list stays up 0.7 s
      expect(k.card.debugView(), "card back on the list after the preset").toBe("list")
      const report = k.pendingId("laptop", "Submit the project report")
      const reply = k.pendingId("laptop", "Reply to the internship email")
      const backup = k.pendingId("laptop", "Back up the thesis folder")
      expect(backup !== "", "preset not saved").toBe(true)
      k.log(`before snooze: ${k.drawnRowTitles().join(" | ")}`)
      expect(k.card.debugRowIds().join(","), "laptop order before snooze").toBe(`${report},${reply},${backup}`)

      await k.press(`MemoryRow-${backup}`)
      expect(k.card.debugView(), "details view").toBe("details")
      expect(k.visible("SnoozeButton"), "SnoozeButton not shown").toBe(true)
      const t0 = Date.now()
      await k.press("SnoozeButton")
      const m = k.app.store.getMemoryById(backup)!
      const minutes = m.dueAt !== undefined ? (m.dueAt - t0) / 60000 : -1
      const toast = k.card.debugFooter()
      k.log(`after snooze: due ${minutes.toFixed(1)} min after the pinch started; toast "${toast}"; rows ${k.drawnRowTitles().join(" | ")} (${k.rowText(backup, "RowMeta")})`)
      expect(minutes > 55 && minutes < 62, `due moved to ${minutes.toFixed(1)} min from now`).toBe(true)
      expect(toast.indexOf("Snoozed to ") === 0, `toast "${toast}"`).toBe(true)
      expect(k.card.debugView(), "card back on the list").toBe("list")
      expect(k.card.debugRowIds().join(","), "laptop order after snooze (re-sorted)").toBe(`${report},${backup},${reply}`)
    })
  }
}
