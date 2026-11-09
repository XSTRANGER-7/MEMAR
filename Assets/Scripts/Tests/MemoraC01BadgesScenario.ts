// MEMAR LEAF — criterion 1: badges at start (demo seed). No interaction: reads what is drawn.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario, SEED_STRIP} from "./MemoraLeafKit"

@component
export class MemoraC01BadgesScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c01-badges", async (k) => {
      const want: [string, number][] = [
        ["laptop", 2],
        ["keys", 1],
        ["bag", 1],
        ["notebook", 0],
      ]
      for (const [id, n] of want) k.expectBadge(id, n)
      expect(k.visible("Badge-notebook"), "Badge-notebook should be hidden").toBe(false)
      expect(k.renderedTexts("Badge-laptop").indexOf("2") >= 0, `Badge-laptop draws ${k.renderedTexts("Badge-laptop").join(",")}`).toBe(true)
      expect(k.strip.getText(), "TodayStrip text").toBe(SEED_STRIP)
      k.log(
        `Badge-laptop ${k.badge("laptop")}, Badge-keys ${k.badge("keys")}, Badge-bag ${k.badge("bag")}, ` +
          `Badge-notebook ${k.visible("Badge-notebook") ? k.badge("notebook") : "hidden"}; TodayStrip "${k.strip.getText()}"`,
      )
    })
  }
}
