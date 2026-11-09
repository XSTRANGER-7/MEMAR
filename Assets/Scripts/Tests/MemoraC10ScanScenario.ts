// MEMAR LEAF — criterion 10: Scan. ScanButton → after the sweep, a ScanTag-<id> "<Short> · <count>"
// is shown for exactly the stand-ins inside the scan cone of the current view.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {targetsInView} from "../Memora/MemoraDetector"
import {findObject} from "../Memora/MemoraObjects"
import {specFor} from "../MemoraUI/MemoraStandInCatalog"
import {THEME} from "../MemoraUI/MemoraThemeUI"
import {runMemoraScenario} from "./MemoraLeafKit"

@component
export class MemoraC10ScanScenario extends Scenario {
  async run(): Promise<void> {
    await runMemoraScenario("memora-c10-scan", async (k) => {
      const det = k.main.getDetection()!
      expect(det.shownScanTags().length, "scan tags before Scan").toBe(0)
      await k.press("ScanButton", 0)
      await sleep((THEME.detect.sweepSeconds + 0.4) * 1000)

      const camT = WorldCameraFinderProvider.getInstance().getTransform()
      const eye = camT.getWorldPosition()
      const fwd = camT.back
      const targets = k.main.getStandIns().map((s) => {
        const p = s.getSceneObject().getTransform().getWorldPosition()
        const c = specFor(s.objectId).colliderCm
        return {id: s.objectId, center: {x: p.x, y: p.y, z: p.z}, radiusCm: 0.5 * Math.max(c[0], c[1], c[2])}
      })
      const expected = targetsInView({x: eye.x, y: eye.y, z: eye.z}, {x: fwd.x, y: fwd.y, z: fwd.z}, targets, THEME.detect.scanHalfAngleDeg)
      const shown = det.shownScanTags()
      k.log(`in view: ${expected.join(",")}; tagged: ${shown.map((id) => `${id}="${det.scanTagText(id)}"`).join(", ")}`)
      expect(expected.length > 0, "nothing in view to scan").toBe(true)
      expect(shown.slice().sort().join(","), "tagged objects vs objects in view").toBe(expected.slice().sort().join(","))
      for (const id of expected) {
        const want = `${findObject(id)?.shortLabel ?? id} · ${k.app.store.pendingCountFor(id)}`
        expect(det.scanTagText(id), `ScanTag-${id}`).toBe(want)
        expect(k.visible(`ScanTag-${id}`), `ScanTag-${id} not drawn`).toBe(true)
      }
    })
  }
}
