// MEMAR LEAF — criterion 9: voice. Object-notebook → AddButton → SpeakButton (real pinches), then the
// transcript hook (real microphone speech can't run in automation) → preview "Print the lab report" →
// SaveVoiceButton adds it. Second round: hook "water the plants" → CancelVoiceButton adds nothing.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {MemoraVoiceInput} from "../MemoraUI/MemoraVoiceInput"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC09VoiceScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c09-voice", async (k) => {
      const voice = k.main.getVoice() ?? MemoraVoiceInput.instance!
      await k.press("Object-notebook")
      await k.press("AddButton")
      await k.press("SpeakButton")
      const v0 = k.card.debugVoice()
      k.log(`after SpeakButton: card view ${k.card.debugView()}, voice status "${v0.status}", mic listening ${voice.isListening()}, footer "${k.card.debugFooter()}"`)
      expect(k.card.debugView() === "voice" || k.card.debugView() === "presets", `after Speak the card shows ${k.card.debugView()}`).toBe(true)

      k.hook('MemoraVoiceInput.submitTranscriptForTest("remind me to print the lab report")', () =>
        voice.submitTranscriptForTest("remind me to print the lab report"),
      )
      await sleep(600)
      const v1 = k.card.debugVoice()
      expect(k.card.debugView(), "card view after the transcript").toBe("voice")
      expect(v1.state, "voice state").toBe("preview")
      expect(v1.text, "voice preview title").toBe("Print the lab report")
      expect(k.renderedTexts("VoiceView").indexOf("Print the lab report") >= 0, "preview title not drawn").toBe(true)
      expect(k.visible("SaveVoiceButton"), "SaveVoiceButton not shown").toBe(true)
      k.log(`voice preview drawn: ${k.renderedTexts("VoiceView").join(" / ")}`)

      const total0 = k.app.store.getMemoryCounts().total
      await k.press("SaveVoiceButton")
      expect(k.pendingId("notebook", "Print the lab report") !== "", "voice memory not saved").toBe(true)
      expect(k.app.store.getMemoryCounts().total, "memory total after Save").toBe(total0 + 1)
      k.expectBadge("notebook", 1)
      k.log(`after Save: rows ${k.drawnRowTitles().join(" | ")}; footer "${k.card.debugFooter()}"`)

      const before = k.app.store.getMemoryCounts().total
      await k.press("AddButton")
      await k.press("SpeakButton")
      k.hook('MemoraVoiceInput.submitTranscriptForTest("remind me to water the plants")', () =>
        voice.submitTranscriptForTest("remind me to water the plants"),
      )
      await sleep(600)
      expect(k.card.debugVoice().text, "second voice preview").toBe("Water the plants")
      await k.press("CancelVoiceButton")
      expect(k.app.store.getMemoryCounts().total, "CancelVoiceButton added a memory").toBe(before)
      expect(voice.isListening(), "mic still listening after Cancel").toBe(false)
      expect(k.card.debugView(), "Cancel returns to the quick-add list").toBe("presets")
      k.expectBadge("notebook", 1)
    })
  }
}
