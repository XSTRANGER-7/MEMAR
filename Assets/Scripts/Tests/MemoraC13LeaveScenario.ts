// MEMAR LEAF — criterion 13: "Before you leave". At start LeaveCheck lists Keys, Bag, Wallet,
// Umbrella; completing those four (real pinches: object, then its DoneButton) makes it read
// "All set to leave ✓".
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario} from "./MemoraLeafKit"

const AT_START = [
  "Before you leave",
  "Keys · Collect the parcel before leaving",
  "Bag · Pack the charger",
  "Wallet · Top up the metro card",
  "Umbrella · Carry the umbrella today",
]
const CARRY: [string, string][] = [
  ["keys", "Collect the parcel before leaving"],
  ["bag", "Pack the charger"],
  ["wallet", "Top up the metro card"],
  ["umbrella", "Carry the umbrella today"],
]

@component
export class MemoraC13LeaveScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c13-leave", async (k) => {
      const leave = k.main.getLeaveCheck()!
      expect(k.visible("LeaveCheck"), "LeaveCheck not shown").toBe(true)
      k.log(`LeaveCheck at start: ${leave.getLines().join(" | ")}; drawn: ${k.renderedTexts("LeaveCheck").join(" | ")}`)
      expect(leave.getLines().join("|"), "LeaveCheck at start").toBe(AT_START.join("|"))
      for (const line of AT_START) expect(k.renderedTexts("LeaveCheck").indexOf(line) >= 0, `"${line}" not drawn`).toBe(true)

      for (const [id, title] of CARRY) {
        await k.press(`Object-${id}`)
        const mid = k.pendingId(id, title)
        expect(mid !== "", `${title} missing`).toBe(true)
        await k.press(`DoneButton-${mid}`, 900)
        k.expectBadge(id, 0)
      }
      k.log(`LeaveCheck after the four: ${leave.getLines().join(" | ")}; drawn: ${k.renderedTexts("LeaveCheck").join(" | ")}`)
      expect(leave.getLines().join("|"), "LeaveCheck after the four").toBe("Before you leave|All set to leave ✓")
      expect(k.renderedTexts("LeaveCheck").indexOf("All set to leave ✓") >= 0, "All set line not drawn").toBe(true)
    })
  }
}
