// MEMAR — shared LEAF test kit for the 14 done-criterion scenarios (Assets/Scripts/Tests).
//
// Owns: the simulated right hand (a LEAF LeafSingleHandInteractor driving SIK's right
// HandInteractor: the hand moves to the target, makes the pinch gesture and SIK delivers
// hover → trigger start → trigger end to the named Interactable), press-with-retry, the
// test-side "head turn" (MemoraWorld turned about the camera so a side-zone target is in
// front, the same as the user turning their head), badge / card / strip reads, and the
// evidence log ("[MEMAR LEAF] <scenario> ...") that the report quotes.
// Every scenario starts from MemoraApp.instance.resetForTest() (the 8-memory demo seed)
// and ends with the world turned back and the seed restored (storage is persistent).
// Must NOT: change Lens code or call the card's debugPress. Test hooks
// (MemoraDetection.simulateGazeAt, MemoraVoiceInput.submitTranscriptForTest) are only
// called through hook(), which logs them as hooks.

import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorTriggerType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {HandType} from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandType"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {BaseLeafInteractor} from "Leaf.lspkg/Interactors/interactor/BaseLeafInteractor"
import {LeafSingleHandInteractor} from "Leaf.lspkg/Interactors/interactor/handInput/LeafHandInteractor"
import {PINCH_POSITION_OFFSET} from "Leaf.lspkg/Interactors/interactor/handInput/Gestures"
import {awaitInteractorEvent, getInteractables, isEnabled} from "Leaf.lspkg/Interactors/InteractableUtils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {MemoraApp} from "../Memora/MemoraApp"
import {MemoraBadgeUI} from "../MemoraUI/MemoraBadgeUI"
import {MemoraCardUI} from "../MemoraUI/MemoraCardUI"
import {MemoraMain} from "../MemoraUI/MemoraMain"
import {MemoraStandIn} from "../MemoraUI/MemoraStandIn"
import {MemoraTodayStripUI} from "../MemoraUI/MemoraTodayStripUI"

const PREFIX = "[MEMAR LEAF]"
/** A full simulated pinch (move 0.5 s + pinch pose 0.5 s + SIK trigger + release pose 0.5 s) takes ~1.6 s. */
const PINCH_TIMEOUT_MS = 6000
/** Wait after each step: the card ignores presses for 0.25 s after its content changes. */
export const STEP_SETTLE_MS = 700
/** Strip text for the demo seed (all three due dates are clamped into today). */
export const SEED_STRIP = "8 pending · 3 due today"

/**
 * The simulated right hand. Same behaviour as LeafHandInteractor.get("right"), plus:
 * - quickPinch(): one SIK pinch-release with the hand already posed (no 0.5 s pose animations),
 *   for the double pinch in criterion 4;
 * - dispose(): drops a half-finished interaction after a missed pinch so a fresh hand can retry.
 */
export class MemoraHand extends LeafSingleHandInteractor {
  constructor(handType: HandType = "right") {
    super(handType, true)
  }

  /**
   * LEAF waits for Interactable.onHoverEnter, which SIK fires only when NO interactor is hovering yet.
   * In this preview the target in the middle of the view (the laptop) is sometimes already marked as
   * hovered by a right-hand interactor when the pinch starts, so that event never comes and LEAF waits
   * forever (seen as a "missed" pinch). Wait for THIS interactor's own hover enter instead, the same
   * way LEAF's exitHover waits for this interactor's hover exit. Trigger start/end are unchanged.
   */
  protected async enterHover(target: Interactable): Promise<void> {
    const entered = awaitInteractorEvent(target.onInteractorHoverEnter, this.sikInteractor)
    await this.setTarget(target)
    await entered
  }

  /** Hover → trigger start → trigger end on `target`, with no hand pose change (hand must already be there). */
  async quickPinch(target: Interactable): Promise<void> {
    await BaseLeafInteractor.prototype.trigger.call(this, target)
  }

  /** Moves the hand onto `target` and closes it into the pinch pose, without triggering. */
  async poseOn(target: Interactable): Promise<void> {
    const p = target.getSceneObject().getTransform().getWorldPosition()
    await this.hand.setPosition(p.add(PINCH_POSITION_OFFSET[this.handType]))
    await this.hand.makeGesture("pinch")
  }

  async relax(): Promise<void> {
    await this.hand.makeGesture("relaxed")
  }

  dispose(): void {
    this.overrideInteractable = undefined
    this.setTriggerType(InteractorTriggerType.None)
    this.destroy()
  }

  /** One line of SIK state for a missed pinch (why no hover / trigger reached the target). */
  diagnose(target: Interactable): string {
    const sik = this.sikInteractor
    const cur = sik.currentInteractable
    return (
      `interactor enabled=${sik.enabled} active=${sik.isActive()} targeting=${sik.isTargeting()} ` +
      `current="${cur && !isNull(cur) ? cur.getSceneObject().name : "none"}" trigger=${sik.currentTrigger}; ` +
      `target enabled=${target.enabled} inHierarchy=${target.getSceneObject().isEnabledInHierarchy} ` +
      `hovering=${target.hoveringInteractor} triggering=${target.triggeringInteractor} colliders=${target.colliders.length} ` +
      `multi=${target.allowMultipleInteractors} targetingMode=${target.targetingMode}`
    )
  }
}

type Outcome = "done" | "timeout"

/** Resolves "done" when `p` settles in time, "timeout" otherwise; rethrows `p`'s error. */
function within(p: Promise<void>, ms: number): Promise<Outcome> {
  return new Promise<Outcome>((resolve, reject) => {
    let finished = false
    p.then(
      () => {
        if (finished) return
        finished = true
        resolve("done")
      },
      (e) => {
        if (finished) return
        finished = true
        reject(e)
      },
    )
    sleep(ms).then(() => {
      if (finished) return
      finished = true
      resolve("timeout")
    })
  })
}

export class MemoraKit {
  app!: MemoraApp
  main!: MemoraMain
  card!: MemoraCardUI
  strip!: MemoraTodayStripUI
  hand!: MemoraHand

  /** Evidence counters, printed at the end of the scenario. */
  realPinches = 0
  retries = 0
  headTurns = 0
  hooks: string[] = []

  private world!: Transform
  private startPos!: vec3
  private startRot!: quat
  private readonly camera = WorldCameraFinderProvider.getInstance()

  constructor(readonly id: string) {}

  log(message: string): void {
    print(`${PREFIX} ${this.id}: ${message}`)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async setUp(): Promise<void> {
    // MemoraMain builds zones, stand-ins, panels in OnStart and turns the world to the camera 2 frames later.
    for (let i = 0; i < 50; i++) {
      const ready = this.tryBind()
      if (ready) break
      await sleep(100)
    }
    expect(!!this.main, "MemoraWorld/MemoraMain not found or not started").toBe(true)
    await sleep(500)
    this.world = this.main.getSceneObject().getTransform()
    this.startPos = this.world.getWorldPosition()
    this.startRot = this.world.getWorldRotation()
    this.hand = new MemoraHand("right")
    this.app.resetForTest()
    await sleep(1000)
    this.log(`start: resetForTest() -> ${this.app.store.getMemoryCounts().pending} pending, strip "${this.strip.getText()}"`)
  }

  private tryBind(): boolean {
    const app = MemoraApp.instance
    const so = findSceneObjectByName("MemoraWorld")
    if (!app || !so) return false
    const main = so.getComponent(MemoraMain.getTypeName()) as MemoraMain | null
    if (!main || main.getStandIns().length < 10 || !main.getDetection()) return false
    this.app = app
    this.main = main
    this.card = main.getCard()
    this.strip = main.getStrip()
    return true
  }

  async tearDown(): Promise<void> {
    if (this.world) {
      this.world.setWorldRotation(this.startRot)
      this.world.setWorldPosition(this.startPos)
    }
    if (this.app) this.app.resetForTest()
    this.log(
      `evidence: ${this.realPinches} real SIK pinches (simulated right hand), ${this.retries} retries, ` +
        `${this.headTurns} test-side head turns, hooks: ${this.hooks.length ? this.hooks.join("; ") : "none"}`,
    )
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  /** The enabled (in hierarchy) Interactable on the SceneObject named `name`, or undefined. */
  find(name: string): Interactable | undefined {
    return getInteractables().filter((i) => i.getSceneObject().name === name && isEnabled(i))[0]
  }

  /**
   * A real SIK pinch by the simulated right hand on the Interactable named `name`.
   * Like a user, it first looks at the target (test-side head turn when the target is outside the
   * middle of the view). A pinch that SIK never delivers (no trigger end within 6 s) is retried
   * once with a fresh hand; the retry is counted and logged.
   */
  async press(name: string, settleMs: number = STEP_SETTLE_MS): Promise<void> {
    const first = this.find(name)
    if (!first) throw new Error(`no enabled interactable "${name}"`)
    if (this.lookAt(first.getSceneObject().getTransform().getWorldPosition(), name)) await sleep(400)
    for (let attempt = 0; attempt < 2; attempt++) {
      const target = attempt === 0 ? first : this.find(name)
      if (!target) throw new Error(`"${name}" disappeared before the retry`)
      if (target.hoveringInteractor !== 0) this.log(`note: "${name}" already hovered (input type ${target.hoveringInteractor}) before the pinch`)
      const t0 = getTime()
      const outcome = await within(this.hand.trigger(target), PINCH_TIMEOUT_MS)
      if (outcome === "done") {
        this.realPinches++
        this.log(`pinch "${name}" (SIK trigger end after ${(getTime() - t0).toFixed(2)} s)`)
        if (settleMs > 0) await sleep(settleMs) // LEAF's sleep rejects 0
        return
      }
      this.retries++
      this.log(`pinch "${name}" missed (no SIK trigger end in ${PINCH_TIMEOUT_MS / 1000} s): ${this.hand.diagnose(target)}`)
      this.log(`retry ${attempt + 1} of "${name}" with a fresh hand`)
      this.hand.dispose()
      this.hand = new MemoraHand("right")
      await sleep(800)
    }
    throw new Error(`pinch "${name}" missed twice`)
  }

  /**
   * Double pinch: the hand is posed on `name` once, then two SIK pinch-release cycles follow
   * back to back (a user pinching twice without moving the hand). Returns the seconds between
   * the two trigger ends.
   */
  async doublePinch(name: string): Promise<number> {
    const target = this.find(name)
    if (!target) throw new Error(`no enabled interactable "${name}"`)
    if (this.lookAt(target.getSceneObject().getTransform().getWorldPosition(), name)) await sleep(400)
    await this.hand.poseOn(target)
    const first = await within(this.hand.quickPinch(target), PINCH_TIMEOUT_MS)
    if (first !== "done") throw new Error(`first pinch of the double pinch on "${name}" missed`)
    const t1 = getTime()
    this.realPinches++
    const again = this.find(name)
    if (!again) throw new Error(`"${name}" was gone right after the first pinch`)
    const second = await within(this.hand.quickPinch(again), PINCH_TIMEOUT_MS)
    if (second !== "done") throw new Error(`second pinch of the double pinch on "${name}" missed`)
    const gap = getTime() - t1
    this.realPinches++
    this.log(`double pinch "${name}": second SIK trigger end ${gap.toFixed(2)} s after the first`)
    await this.hand.relax()
    return gap
  }

  /** Runs a Lens test hook and records it as such in the evidence line. */
  hook<T>(label: string, fn: () => T): T {
    this.hooks.push(label)
    this.log(`HOOK ${label}`)
    return fn()
  }

  // ── Head turn (test-side) ─────────────────────────────────────────────────

  /** True when `p` is in front of the camera and inside the view (5% margin on each edge). */
  inView(p: vec3): boolean {
    const camT = this.camera.getTransform()
    if (p.sub(camT.getWorldPosition()).dot(camT.back) <= 0) return false
    const ss = this.camera.worldSpaceToScreenSpace(p.x, p.y, p.z)
    return ss.x > 0.05 && ss.x < 0.95 && ss.y > 0.05 && ss.y < 0.95
  }

  /**
   * When `target` is outside the view, turns MemoraWorld about the camera (yaw only)
   * so it is straight ahead: the same relative pose as the user turning their head. Logged + counted.
   */
  lookAt(target: vec3, label: string): boolean {
    if (this.inView(target)) return false
    const deg = this.turnToward(target)
    this.headTurns++
    this.log(`head turn ${deg.toFixed(0)}° toward "${label}" (MemoraWorld yawed about the camera)`)
    return true
  }

  /** Turns the world back to the start pose (the user facing the desk again). */
  faceDesk(): void {
    this.world.setWorldRotation(this.startRot)
    this.world.setWorldPosition(this.startPos)
  }

  /** Yaws MemoraWorld about the eye so `target` is straight ahead; returns the turn in degrees. */
  private turnToward(target: vec3): number {
    const camT = this.camera.getTransform()
    const eye = camT.getWorldPosition()
    const f = camT.back
    const fwd = new vec3(f.x, 0, f.z).normalize()
    const d = target.sub(eye)
    const dir = new vec3(d.x, 0, d.z).normalize()
    const angle = Math.atan2(fwd.cross(dir).y, fwd.dot(dir))
    this.rotateWorldAboutEye(quat.angleAxis(-angle, vec3.up()))
    return (angle * 180) / Math.PI
  }

  /** Turns the world so the camera's view ray goes through `target` (yaw + pitch, about the eye). */
  aimAt(target: vec3, label: string): void {
    const camT = this.camera.getTransform()
    const eye = camT.getWorldPosition()
    const toTarget = target.sub(eye).normalize()
    this.rotateWorldAboutEye(quat.rotationFromTo(toTarget, camT.back.normalize()))
    this.headTurns++
    this.log(`head turn (yaw + pitch): view ray aimed at "${label}"`)
  }

  private rotateWorldAboutEye(q: quat): void {
    const eye = this.camera.getTransform().getWorldPosition()
    const pos = this.world.getWorldPosition()
    this.world.setWorldPosition(eye.add(q.multiplyVec3(pos.sub(eye))))
    this.world.setWorldRotation(q.multiply(this.world.getWorldRotation()))
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  standIn(id: string): MemoraStandIn {
    const s = this.main.getStandIns().filter((x) => x.objectId === id)[0]
    expect(!!s, `no stand-in for "${id}"`).toBe(true)
    return s
  }

  /** The badge on Object-<id>, read from the SceneObject named Badge-<id>. 0 = hidden. */
  badge(id: string): number {
    const so = findSceneObjectByName(`Badge-${id}`)
    expect(!!so, `no SceneObject "Badge-${id}"`).toBe(true)
    const b = so!.getComponent(MemoraBadgeUI.getTypeName()) as MemoraBadgeUI
    return b.isShown() ? b.getCount() : 0
  }

  expectBadge(id: string, n: number): void {
    const shown = this.badge(id)
    expect(shown, `Badge-${id} shows ${shown === 0 ? "nothing" : shown}, expected ${n === 0 ? "hidden" : n}`).toBe(n)
    expect(this.app.store.pendingCountFor(id), `store pending for ${id}`).toBe(n)
  }

  /** Id of the pending memory titled `title` on `objectId` ("" when none). */
  pendingId(objectId: string, title: string): string {
    const m = this.app.store.getPendingMemoriesByObject(objectId).filter((x) => x.title === title)[0]
    return m ? m.id : ""
  }

  pendingTitles(objectId: string): string[] {
    return this.app.store.getPendingMemoriesByObject(objectId).map((m) => m.title)
  }

  /** True when the SceneObject named `name` exists and is enabled in the hierarchy. */
  visible(name: string): boolean {
    const so = findSceneObjectByName(name)
    return !!so && so.isEnabledInHierarchy
  }

  /** Text of every enabled Text component under the SceneObject named `name` (what is drawn). */
  renderedTexts(name: string): string[] {
    const root = findSceneObjectByName(name)
    const out: string[] = []
    const walk = (o: SceneObject) => {
      if (!o.isEnabledInHierarchy) return
      for (const t of o.getComponents("Component.Text") as Text[]) if (t.text) out.push(t.text)
      for (let i = 0; i < o.getChildrenCount(); i++) walk(o.getChild(i))
    }
    if (root) walk(root)
    return out
  }

  /** Drawn title + meta of the card row MemoryRow-<memoryId> ("" when the row is not shown). */
  rowText(memoryId: string, part: "RowTitle" | "RowMeta"): string {
    const row = findSceneObjectByName(`MemoryRow-${memoryId}`)
    if (!row || !row.isEnabledInHierarchy) return ""
    const so = findSceneObjectByName(part, row)
    const t = so ? (so.getComponent("Component.Text") as Text | null) : null
    return t ? t.text : ""
  }

  /** Titles drawn on the card's rows, top to bottom. */
  drawnRowTitles(): string[] {
    return this.card.debugRowIds().map((id) => this.rowText(id, "RowTitle"))
  }

  /** The card sits in front of the object (closer to the eye, within 25° of its line of sight) and within reach. */
  expectCardNear(id: string): void {
    const eye = this.camera.getTransform().getWorldPosition()
    const obj = this.standIn(id).getSceneObject().getTransform().getWorldPosition()
    const p = this.card.getSceneObject().getTransform().getWorldPosition()
    const toObj = obj.sub(eye)
    const toCard = p.sub(eye)
    const angle = (Math.acos(Math.max(-1, Math.min(1, toObj.normalize().dot(toCard.normalize())))) * 180) / Math.PI
    this.log(`card ${toCard.length.toFixed(1)} cm from the eye, ${id} ${toObj.length.toFixed(0)} cm, ${angle.toFixed(1)}° apart`)
    expect(toCard.length < toObj.length && angle < 25, `card not beside ${id}: ${toCard.length.toFixed(0)} cm vs ${toObj.length.toFixed(0)} cm, ${angle.toFixed(1)}°`).toBe(true)
    // MemoraPlacement clamps the distance along the view ray to 62 cm; the straight-line distance to the
    // card's anchor can be a little more (pitch). Its own note: a card at 64 cm still takes pinches.
    expect(toCard.length <= 64, `card ${toCard.length.toFixed(1)} cm away (reach limit 62 cm + pitch, pinchable up to 64 cm)`).toBe(true)
  }
}

/** Runs one MEMAR scenario: seed reset → body → world/seed restored, with the evidence line printed. */
export async function runMemoraScenario(id: string, body: (k: MemoraKit) => Promise<void>): Promise<void> {
  const kit = new MemoraKit(id)
  try {
    await kit.setUp()
    await body(kit)
    kit.log("all checks passed")
  } catch (e) {
    kit.log(`FAILED: ${e}`)
    throw e
  } finally {
    await kit.tearDown()
  }
}
