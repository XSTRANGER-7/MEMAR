// MEMAR LEAF — criterion 14: help. HelpButton on the today strip → HelpCard with 4 lines;
// HelpCloseButton closes it.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC14HelpScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c14-help", async (k) => {
      const help = k.main.getHelp()!
      expect(help.isOpen() || k.visible("HelpCard"), "HelpCard open before HelpButton").toBe(false)

      await k.press("HelpButton")
      expect(help.isOpen() && k.visible("HelpCard"), "HelpCard did not open").toBe(true)
      const lines = help.getLines()
      const drawn = k.renderedTexts("HelpCard")
      k.log(`HelpCard lines: ${lines.join(" | ")}; drawn: ${drawn.join(" | ")}`)
      expect(lines.length, "help line count").toBe(4)
      for (const line of lines) expect(drawn.indexOf(line) >= 0, `help line "${line}" not drawn`).toBe(true)
      expect(k.card.isOpen(), "memory card should be closed while help is up").toBe(false)

      await k.press("HelpCloseButton")
      expect(help.isOpen() || k.visible("HelpCard"), "HelpCard still open after HelpCloseButton").toBe(false)
    })
  }
}
