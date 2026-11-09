// MEMAR LEAF — criterion 8: Done list. Fridge Done on "Buy milk on the way back" →
// DoneListButton → ArchivePanel lists it first → RestoreButton puts it back → ArchiveCloseButton.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC08DoneListScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c08-done-list", async (k) => {
      await k.press("Object-fridge")
      const milk = k.pendingId("fridge", "Buy milk on the way back")
      expect(milk !== "", "milk missing from the seed").toBe(true)
      expect(k.drawnRowTitles()[0], "fridge card first row").toBe("Buy milk on the way back")

      await k.press(`DoneButton-${milk}`, 900)
      k.expectBadge("fridge", 0)

      await k.press("DoneListButton")
      const archive = k.main.getArchive()!
      expect(archive.isOpen() && k.visible("ArchivePanel"), "ArchivePanel did not open").toBe(true)
      expect(archive.shownIds()[0], "first Done item").toBe(milk)
      expect(k.card.isOpen(), "card should close when the Done list opens").toBe(false)
      k.log(`ArchivePanel: ${k.renderedTexts("ArchivePanel").join(" / ")}`)

      await k.press(`RestoreButton-${milk}`)
      expect(k.app.store.getMemoryById(milk)!.status, "milk after Restore").toBe("pending")
      k.expectBadge("fridge", 1)

      await k.press("ArchiveCloseButton")
      expect(archive.isOpen() || k.visible("ArchivePanel"), "ArchivePanel still open after ArchiveCloseButton").toBe(false)
    })
  }
}
