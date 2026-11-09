// MEMAR LEAF — criterion 7: look-to-detect.
// Part A (the criterion): gaze hook on the keys → DetectReticle → DetectChip "Keys · 1 memory" →
// real pinch on the chip → keys card, chip gone.
// Part B (extra): the real gaze path, no hook. The view ray is aimed at Object-bag by turning
// MemoraWorld about the camera (yaw + pitch, the same as the user turning their head); the
// detector must lock by itself after its 0.9 s dwell, then a real pinch on the chip opens the bag
// card. The preview camera itself can't be driven from a Lens script, so this is the closest
// real-gaze check available in automation.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC07DetectScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c07-detect", async (k) => {
      const det = k.main.getDetection()!
      const ok = k.hook('MemoraDetection.simulateGazeAt("keys")', () => det.simulateGazeAt("keys"))
      expect(ok, "simulateGazeAt returned false").toBe(true)
      await sleep(400)
      expect(det.reticleShown() && k.visible("DetectReticle"), "DetectReticle not shown").toBe(true)
      expect(det.chipObjectId(), "chip object").toBe("keys")
      expect(det.chipText().indexOf("Keys · 1 memory") === 0, `chip reads "${det.chipText()}"`).toBe(true)
      expect(k.visible("DetectChip"), "DetectChip not visible").toBe(true)
      k.log(`DetectChip "${det.chipText()}"`)

      await k.press("DetectChip")
      expect(k.card.isOpen() && k.app.selectedObjectId === "keys", "chip pinch did not open the keys card").toBe(true)
      expect(k.drawnRowTitles()[0], "keys card first row").toBe("Collect the parcel before leaving")
      expect(det.chipObjectId(), "chip still shown after the card opened").toBe(undefined)

      // Part B: real dwell on the bag (not the selected keys; the detector skips the open object).
      await k.press("CloseButton")
      await sleep(1700) // let the hook's simulated chip window lapse
      const bag = k.standIn("bag").getSceneObject().getTransform().getWorldPosition()
      k.aimAt(bag, "Object-bag")
      let lockedAfter = -1
      const t0 = getTime()
      for (let i = 0; i < 40; i++) {
        await sleep(100)
        if (det.chipObjectId() === "bag") {
          lockedAfter = getTime() - t0
          break
        }
      }
      const state = det.getState()
      k.log(
        lockedAfter >= 0
          ? `REAL GAZE: detector locked on bag by itself after ${lockedAfter.toFixed(2)} s; chip "${det.chipText()}"`
          : `REAL GAZE: no lock on bag within 4 s (phase ${state.phase}, target ${state.targetId}, progress ${state.progress})`,
      )
      expect(lockedAfter >= 0, "real gaze dwell on the bag did not lock").toBe(true)
      expect(det.chipText().indexOf("Bag · 1 memory") === 0, `bag chip reads "${det.chipText()}"`).toBe(true)
      await k.press("DetectChip")
      expect(k.card.isOpen() && k.app.selectedObjectId === "bag", "bag chip pinch did not open the bag card").toBe(true)
      expect(k.drawnRowTitles()[0], "bag card first row").toBe("Pack the charger")
      k.faceDesk()
    })
  }
}
