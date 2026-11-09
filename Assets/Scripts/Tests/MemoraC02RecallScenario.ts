// MEMAR LEAF — criterion 2: recall by object. Pinch Object-laptop → laptop titles only,
// first "Submit the project report"; pinch Object-keys → the parcel; CloseButton closes.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC02RecallScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c02-recall", async (k) => {
      await k.press("Object-laptop")
      expect(k.card.isOpen() && k.visible("MemoryCard"), "MemoryCard did not open").toBe(true)
      expect(k.app.selectedObjectId, "selected object").toBe("laptop")
      expect(k.card.debugView(), "card view").toBe("list")
      const rows = k.drawnRowTitles()
      k.log(`laptop card rows: ${rows.join(" | ")}`)
      expect(rows.join("|"), "laptop rows are the laptop's pending titles, in order").toBe(k.pendingTitles("laptop").join("|"))
      expect(rows.length, "laptop row count").toBe(2)
      expect(rows[0], "first laptop row").toBe("Submit the project report")
      expect(rows.indexOf("Collect the parcel before leaving"), "keys memory on the laptop card").toBe(-1)
      k.expectCardNear("laptop")

      await k.press("Object-keys")
      expect(k.app.selectedObjectId, "selected object").toBe("keys")
      const keyRows = k.drawnRowTitles()
      k.log(`keys card rows: ${keyRows.join(" | ")}`)
      expect(keyRows.join("|"), "keys card rows").toBe("Collect the parcel before leaving")
      k.expectCardNear("keys")

      await k.press("CloseButton")
      expect(k.card.isOpen() || k.visible("MemoryCard"), "card still open after CloseButton").toBe(false)
    })
  }
}
