// MEMAR — in-Lens walkthrough of done criteria 1–14 with REAL SIK pinches (debug tool).
// Lives on the authored SceneObject "MemoraSelfTest" under MemoraWorld. Off by default.
//
// Owns: a scripted sequence that pinches objects and buttons by their LEAF names
// through the same path the coordinator's PreviewInteractTool uses
// (AiPreviewAgentInteract's AiHandInteractor: a simulated SIK hand pinching the
// Interactable after the same obstruction check), plus checks on the store,
// badges, strip, card, detection, archive and voice. Gaze and speech use the LEAF
// hooks (MemoraDetection.simulateGazeAt, MemoraVoiceInput.submitTranscriptForTest).
// Prints one PASS/FAIL line per criterion, then resets to the demo seed.
// Also "showcase" states for Preview screenshots (turns the world toward a zone).
// Depends on the AiPreviewAgentInteract + Leaf packages (Preview tooling only).
// Must NOT: run in a shipped Lens (leave runOnStart and showcase off).
// Size note (~420 lines): one linear script per criterion; split per criterion if it grows.

import {AiHandInteractor} from "AiPreviewAgentInteract.lspkg/interactor/HandInteractor"
import {validateInteractable} from "AiPreviewAgentInteract.lspkg/interactor/InteractableValidator"
import {getInteractables} from "Leaf.lspkg/Interactors/InteractableUtils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {MemoraApp} from "../Memora/MemoraApp"
import {targetsInView} from "../Memora/MemoraDetector"
import {findObject, findZone} from "../Memora/MemoraObjects"
import {MemoraMain} from "./MemoraMain"
import {MemoraStandIn} from "./MemoraStandIn"
import {specFor} from "./MemoraStandInCatalog"
import {MemoraVoiceInput} from "./MemoraVoiceInput"
import {THEME} from "./MemoraThemeUI"

const PREFIX = "[MEMAR SelfTest]"
const CRITERIA = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14"]
const LEAVE_AT_START = [
  "Before you leave",
  "Keys · Collect the parcel before leaving",
  "Bag · Pack the charger",
  "Wallet · Top up the metro card",
  "Umbrella · Carry the umbrella today",
]

@component
export class MemoraSelfTest extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MemoraSelfTest – real-pinch walkthrough of done criteria 1–14 (debug)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The MemoraMain on MemoraWorld")
  main!: MemoraMain
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Run the walkthrough when the preview starts. Leave off for normal use")
  runOnStart: boolean = false

  @input
  @hint("Seconds to wait after each pinch")
  @widget(new SliderWidget(0.3, 2, 0.1))
  stepDelaySeconds: number = 0.7

  @input
  @hint("When runOnStart is off: put the Lens in this state after start, for Preview screenshots")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Off", ""),
      new ComboBoxItem("Laptop list", "laptop-list"),
      new ComboBoxItem("Notebook quick add", "notebook-presets"),
      new ComboBoxItem("Notebook voice preview", "notebook-voice"),
      new ComboBoxItem("Laptop details", "laptop-details"),
      new ComboBoxItem("Keys detected", "detect-keys"),
      new ComboBoxItem("Scan", "scan"),
      new ComboBoxItem("Done archive", "archive"),
      new ComboBoxItem("Look at entryway", "view-entryway"),
      new ComboBoxItem("Look at kitchen", "view-kitchen"),
      new ComboBoxItem("Fridge card", "fridge-card"),
      new ComboBoxItem("Door card", "door-card"),
      new ComboBoxItem("Before you leave (door note)", "leave-check"),
      new ComboBoxItem("Before you leave: all set", "leave-all-set"),
      new ComboBoxItem("Help card", "help"),
      new ComboBoxItem("Medicine details (routine)", "medicine-details"),
    ]),
  )
  showcase: string = ""
  @ui.group_end

  private failures: Record<string, string[]> = {}
  private hand: AiHandInteractor | undefined
  private realPinches = 0
  private retries = 0
  private fallbacks = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.runOnStart && !this.showcase) return
      this.wait(2.0)
        .then(() => (this.runOnStart ? this.runAll() : this.runShowcase(this.showcase)))
        .catch((e) => print(`${PREFIX} stopped: ${e} ${(e as Error).stack ?? ""}`))
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private wait(seconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const e = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
      e.bind(() => resolve())
      e.reset(seconds)
    })
  }

  private check(c: string, ok: boolean, message: string): void {
    if (ok) return
    if (!this.failures[c]) this.failures[c] = []
    this.failures[c].push(message)
  }

  private async getHand(): Promise<AiHandInteractor> {
    if (this.hand) return this.hand
    let lastError: unknown
    for (let i = 0; i < 20; i++) {
      try {
        this.hand = new AiHandInteractor("right")
        return this.hand
      } catch (e) {
        lastError = e
        await this.wait(0.05)
      }
    }
    throw lastError
  }

  /**
   * A real SIK pinch on the enabled Interactable named `name` (same path as PreviewInteractTool's Pinch).
   * The simulated hand occasionally never registers a pinch (the fingertip sits on the target but SIK
   * reports no direct target); it is retried (up to twice) with a fresh hand and counted in `retries`.
   */
  private async pinch(c: string, name: string, settle: boolean = true, quiet: boolean = false): Promise<boolean> {
    const find = () => getInteractables().filter((i) => i.getSceneObject().name === name && i.getSceneObject().isEnabledInHierarchy)[0]
    const interactable = find()
    if (!interactable) {
      this.check(c, false, `no enabled interactable "${name}"`)
      return false
    }
    // Like a user, look at the thing before pinching it: SIK ignores pinches outside the field of view.
    if (this.lookAt(interactable.getSceneObject().getTransform().getWorldPosition())) await this.wait(0.25)
    const v = await validateInteractable(interactable)
    if (!v.valid) {
      this.check(c, false, `"${name}" not pinchable: ${v.message}`)
      return false
    }
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      const target = attempt === 0 ? interactable : find()
      if (!target) break
      try {
        const hand = await this.getHand()
        await hand.pinchInteractable(target, false)
        this.realPinches++
        if (settle) await this.wait(this.stepDelaySeconds)
        return true
      } catch (e) {
        lastError = e
        // A failed pinch can leave the simulated hand pinched; retry with a fresh hand.
        if (this.hand) this.hand.destroy()
        this.hand = undefined
        if (attempt < 2) {
          this.retries++
          // Last try: face the target squarely, as a user would after a missed pinch.
          if (attempt === 1) this.turnWorldToward(target.getSceneObject().getTransform().getWorldPosition())
          await this.wait(1.0)
        }
      }
    }
    if (quiet) print(`${PREFIX} ${c}: pinch "${name}" missed three times; using the debug path`)
    else this.check(c, false, `pinch "${name}" failed three times: ${lastError}`)
    return false
  }

  private stand(id: string): MemoraStandIn {
    return this.main.getStandIns().filter((s) => s.objectId === id)[0]
  }

  private expectBadge(c: string, id: string, n: number): void {
    const s = this.stand(id)
    if (!s) {
      this.check(c, false, `no stand-in for ${id}`)
      return
    }
    const shown = s.badge.isShown()
    const ok = n === 0 ? !shown : shown && s.badge.getCount() === n
    this.check(c, ok, `${id} badge shows ${shown ? s.badge.getCount() : "nothing"} (expected ${n === 0 ? "no badge" : n})`)
  }

  private pendingId(objectId: string, title: string): string {
    const app = MemoraApp.instance!
    const m = app.store.getPendingMemoriesByObject(objectId).filter((x) => x.title === title)[0]
    return m ? m.id : ""
  }

  /** The card opens next to the object (MemoraPlacement): in front of it, within ~25° of its line of sight. */
  private cardNear(c: string, id: string): void {
    const card = this.main.getCard()
    const eye = WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()
    const obj = this.stand(id).getSceneObject().getTransform().getWorldPosition()
    const p = card.getSceneObject().getTransform().getWorldPosition()
    const toObj = obj.sub(eye)
    const toCard = p.sub(eye)
    const angle = (Math.acos(Math.max(-1, Math.min(1, toObj.normalize().dot(toCard.normalize())))) * 180) / Math.PI
    const ok = toCard.length < toObj.length && angle < 25
    this.check(c, ok, `card ${toCard.length.toFixed(0)} cm away vs ${id} ${toObj.length.toFixed(0)} cm, ${angle.toFixed(1)}° off its line of sight`)
  }

  // ── The walkthrough ───────────────────────────────────────────────────────

  private async runAll(): Promise<void> {
    const app = MemoraApp.instance
    if (!app || !this.main) {
      print(`${PREFIX} cannot run: MemoraApp or main missing`)
      return
    }
    print(`${PREFIX} running criteria 1–14 with real SIK pinches`)
    const card = this.main.getCard()
    const strip = this.main.getStrip()
    const detection = this.main.getDetection()!
    const archive = this.main.getArchive()!
    const voice = MemoraVoiceInput.instance!
    const startRotation = this.main.getSceneObject().getTransform().getWorldRotation()
    app.resetForTest()
    await this.wait(1.0)

    // C1 + C6: start state.
    for (const [id, n] of [["laptop", 2], ["keys", 1], ["bag", 1], ["notebook", 0]] as [string, number][]) this.expectBadge("C1", id, n)
    this.check("C1", strip.getText() === "8 pending · 3 due today", `strip reads "${strip.getText()}"`)
    for (const [id, n] of [["wallet", 1], ["umbrella", 1], ["medicine", 1], ["fridge", 1], ["door", 0], ["bottle", 0]] as [string, number][])
      this.expectBadge("C6", id, n)
    this.check("C6", strip.getZoneHintText("entryway").indexOf("Entryway · 2") >= 0, `entryway hint "${strip.getZoneHintText("entryway")}"`)
    this.check("C6", strip.getZoneHintText("kitchen").indexOf("Kitchen · 2") >= 0, `kitchen hint "${strip.getZoneHintText("kitchen")}"`)
    // C13 (start): the note on the front door lists the four carry-along things that still need something.
    const leave = this.main.getLeaveCheck()!
    this.check("C13", leave.getLines().join("|") === LEAVE_AT_START.join("|"), `LeaveCheck at start: ${leave.getLines().join(" | ")}`)

    // C2: pinch laptop → card beside it; pinch keys → card moves; X closes.
    await this.pinch("C2", "Object-laptop")
    this.check("C2", card.isOpen() && card.debugView() === "list", "card did not open on the list")
    this.check("C2", card.debugRowTitles()[0] === "Submit the project report", `first row "${card.debugRowTitles()[0]}"`)
    this.check("C2", card.debugRowTitles().length === 2, `laptop rows: ${card.debugRowTitles().join(" | ")}`)
    this.cardNear("C2", "laptop")
    await this.pinch("C2", "Object-keys")
    this.cardNear("C2", "keys")
    this.check("C2", card.debugRowTitles().join("|") === "Collect the parcel before leaving", `keys rows: ${card.debugRowTitles().join(" | ")}`)
    await this.pinch("C2", "CloseButton")
    this.check("C2", !card.isOpen(), "card still open after CloseButton")

    // C3: Done removes the row; badge + strip update; Undo restores.
    await this.pinch("C3", "Object-laptop")
    const report = this.pendingId("laptop", "Submit the project report")
    await this.pinch("C3", `DoneButton-${report}`)
    this.check("C3", card.debugRowIds().indexOf(report) < 0, "report row is still on the card")
    this.expectBadge("C3", "laptop", 1)
    this.check("C3", strip.getText() === "7 pending · 2 due today", `strip after Done "${strip.getText()}"`)
    this.check("C3", card.debugUndoVisible(), "Undo is not visible")
    await this.pinch("C3", "UndoButton")
    this.check("C3", card.debugRowIds()[0] === report, "report did not come back first")
    this.expectBadge("C3", "laptop", 2)
    this.check("C3", strip.getText() === "8 pending · 3 due today", `strip after Undo "${strip.getText()}"`)

    // C4: notebook → Add → preset (quick double pinch) saves one.
    await this.pinch("C4", "Object-notebook")
    this.check("C4", card.debugRowIds().length === 0, "notebook should start empty")
    await this.pinch("C4", "AddButton")
    this.check("C4", card.debugView() === "presets", "quick-add list did not open")
    const presetName = "Preset-Review meeting action items"
    // One real pinch, then a second press of the same preset straight away (the simulated hand needs
    // ~2 s per pinch, longer than the 0.7 s the quick-add list stays up, so the "double" is a debug press).
    const firstPinch = this.pinch("C4", presetName, false)
    // The moment the first pinch has saved, press the same preset again (still on screen for 0.7 s).
    for (let i = 0; i < 300 && app.store.getPendingMemoriesByObject("notebook").length === 0; i++) await this.wait(0.02)
    this.check("C4", card.debugPress(presetName), "second press: preset no longer on screen")
    await firstPinch
    await this.wait(1.4)
    this.check("C4", app.store.getPendingMemoriesByObject("notebook").length === 1, `notebook has ${app.store.getPendingMemoriesByObject("notebook").length} after a double pinch`)
    this.expectBadge("C4", "notebook", 1)
    this.check("C4", card.debugView() === "list", "card did not return to the list")

    // C5: details → priority → Delete/Keep keeps it → Delete/Confirm removes it.
    const note = this.pendingId("notebook", "Review meeting action items")
    await this.pinch("C5", `MemoryRow-${note}`)
    this.check("C5", card.debugView() === "details", "details view did not open")
    await this.pinch("C5", "PriorityButton")
    const m = app.store.getMemoryById(note)
    this.check("C5", !!m && m.priority === "high", `priority is ${m ? m.priority : "missing"} (expected medium → high)`)
    await this.pinch("C5", "DeleteButton")
    this.check("C5", card.debugConfirming(), "delete confirmation did not show")
    await this.pinch("C5", "CancelDeleteButton")
    this.check("C5", !!app.store.getMemoryById(note) && !card.debugConfirming(), "Cancel did not keep the memory")
    await this.pinch("C5", "DeleteButton")
    await this.pinch("C5", "ConfirmDeleteButton")
    this.check("C5", !app.store.getMemoryById(note), "memory still exists after Confirm")
    this.expectBadge("C5", "notebook", 0)
    await this.pinch("C5", "CloseButton")

    // C7: look at the keys (gaze hook) → reticle + chip → pinch the chip → keys card.
    this.check("C7", detection.simulateGazeAt("keys"), "simulateGazeAt failed")
    await this.wait(0.4)
    this.check("C7", detection.reticleShown(), "detection reticle not shown")
    this.check("C7", detection.chipObjectId() === "keys", `chip is on ${detection.chipObjectId()}`)
    this.check("C7", detection.chipText().indexOf("Keys · 1 memory") === 0, `chip reads "${detection.chipText()}"`)
    await this.pinch("C7", "DetectChip")
    this.check("C7", card.isOpen() && app.selectedObjectId === "keys", "chip pinch did not open the keys card")
    this.check("C7", card.debugRowTitles()[0] === "Collect the parcel before leaving", `keys card first row "${card.debugRowTitles()[0]}"`)
    this.check("C7", !detection.chipObjectId(), "chip still shown after the card opened")

    // C8: Done on the fridge's milk → Done list shows it first → Restore puts it back.
    await this.pinch("C8", "Object-fridge")
    const milk = this.pendingId("fridge", "Buy milk on the way back")
    await this.pinch("C8", `DoneButton-${milk}`)
    this.expectBadge("C8", "fridge", 0)
    await this.pinch("C8", "DoneListButton")
    this.check("C8", archive.isOpen() && archive.shownIds()[0] === milk, `archive first item ${archive.shownIds()[0]} (open ${archive.isOpen()})`)
    this.check("C8", !card.isOpen(), "card should close when the Done list opens")
    await this.pinch("C8", `RestoreButton-${milk}`)
    this.check("C8", app.store.getPendingMemoriesByObject("fridge").length === 1, "milk is not pending on the fridge again")
    this.expectBadge("C8", "fridge", 1)
    await this.pinch("C8", "ArchiveCloseButton")
    this.check("C8", !archive.isOpen(), "archive still open after X")

    // C9: notebook → Add → Speak → transcript hook → preview → Save; then Cancel adds nothing.
    await this.pinch("C9", "Object-notebook")
    await this.pinch("C9", "AddButton")
    await this.pinch("C9", "SpeakButton")
    this.check("C9", card.debugView() === "voice" || card.debugView() === "presets", `after Speak the card shows ${card.debugView()}`)
    voice.submitTranscriptForTest("remind me to print the lab report")
    await this.wait(0.5)
    this.check("C9", card.debugView() === "voice" && card.debugVoice().text === "Print the lab report", `voice preview "${card.debugVoice().text}"`)
    await this.pinch("C9", "SaveVoiceButton")
    this.check("C9", this.pendingId("notebook", "Print the lab report") !== "", "voice memory not saved")
    this.expectBadge("C9", "notebook", 1)
    const before = app.store.getMemoryCounts().total
    await this.pinch("C9", "AddButton")
    await this.pinch("C9", "SpeakButton")
    voice.submitTranscriptForTest("remind me to water the plants")
    await this.wait(0.5)
    await this.pinch("C9", "CancelVoiceButton")
    this.check("C9", app.store.getMemoryCounts().total === before, "Cancel added a memory")
    this.check("C9", !voice.isListening(), "mic still listening after Cancel")
    await this.pinch("C9", "CloseButton")

    // C10: Scan tags every stand-in in view with its count.
    await this.pinch("C10", "ScanButton")
    await this.wait(THEME.detect.sweepSeconds + 0.4)
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const eye = camT.getWorldPosition()
    const fwd = camT.back
    const targets = this.main.getStandIns().map((s) => {
      const p = s.getSceneObject().getTransform().getWorldPosition()
      const c = specFor(s.objectId).colliderCm
      return {id: s.objectId, center: {x: p.x, y: p.y, z: p.z}, radiusCm: 0.5 * Math.max(c[0], c[1], c[2])}
    })
    const expected = targetsInView({x: eye.x, y: eye.y, z: eye.z}, {x: fwd.x, y: fwd.y, z: fwd.z}, targets, THEME.detect.scanHalfAngleDeg)
    const shown = detection.shownScanTags()
    this.check("C10", expected.length > 0, "nothing in view to scan")
    this.check("C10", expected.slice().sort().join(",") === shown.slice().sort().join(","), `tags ${shown.join(",")} vs in view ${expected.join(",")}`)
    for (const id of expected) {
      const want = `${findObject(id)?.shortLabel ?? id} · ${app.store.pendingCountFor(id)}`
      this.check("C10", detection.scanTagText(id) === want, `ScanTag-${id} reads "${detection.scanTagText(id)}" (want "${want}")`)
    }

    // C11: Done on the daily vitamin D → "back tomorrow" toast, badge stays 1, row reads Tomorrow … Daily; Undo leaves one.
    await this.pinch("C11", "Object-medicine")
    const vit = this.pendingId("medicine", "Take vitamin D after lunch")
    this.check("C11", (card.debugRowMetas()[0] ?? "").indexOf("Daily") > 0, `vitamin D row meta "${card.debugRowMetas()[0]}"`)
    await this.pinch("C11", `DoneButton-${vit}`)
    await this.wait(0.3)
    this.check("C11", card.debugFooter().indexOf("Done · back tomorrow") === 0, `toast "${card.debugFooter()}"`)
    this.expectBadge("C11", "medicine", 1)
    const nextRows = card.debugRowMetas()
    this.check("C11", nextRows.length === 1 && nextRows[0].indexOf("Tomorrow") >= 0 && nextRows[0].indexOf("Daily") > 0, `rows after Done: ${nextRows.join(" | ")}`)
    await this.pinch("C11", "UndoButton")
    const vits = app.store.getPendingMemoriesByObject("medicine").filter((x) => x.title === "Take vitamin D after lunch")
    this.check("C11", vits.length === 1 && vits[0].id === vit, `after Undo: ${vits.length} vitamin D rows`)
    this.expectBadge("C11", "medicine", 1)
    this.check("C11", card.debugRowIds().length === 1, `medicine card rows after Undo: ${card.debugRowTitles().join(" | ")}`)

    // C12: notebook gets a second memory; Snooze the later one → due ≈ now + 1 h, toast, list re-sorts.
    await this.pinch("C12", "Object-notebook")
    await this.pinch("C12", "AddButton")
    await this.pinch("C12", "Preset-Review meeting action items")
    await this.wait(1.0)
    const lab = this.pendingId("notebook", "Print the lab report")
    const review = this.pendingId("notebook", "Review meeting action items")
    this.check("C12", card.debugRowIds().join(",") === `${review},${lab}`, `notebook order before snooze: ${card.debugRowTitles().join(" | ")}`)
    await this.pinch("C12", `MemoryRow-${lab}`)
    this.check("C12", card.debugView() === "details", "details did not open")
    const t0 = Date.now()
    await this.pinch("C12", "SnoozeButton")
    const snoozed = app.store.getMemoryById(lab)
    const delta = snoozed && snoozed.dueAt !== undefined ? (snoozed.dueAt - t0) / 60000 : -1
    this.check("C12", delta > 55 && delta < 62, `due moved to ${delta.toFixed(1)} min from now`)
    this.check("C12", card.debugFooter().indexOf("Snoozed to ") === 0, `toast "${card.debugFooter()}"`)
    this.check("C12", card.debugView() === "list" && card.debugRowIds().join(",") === `${lab},${review}`, `order after snooze: ${card.debugRowTitles().join(" | ")}`)
    await this.pinch("C12", "CloseButton")

    // C14: "Pinch ? for help" after the first selection; ? opens the help card; X closes it.
    this.check("C14", strip.getHintText() === "Pinch ? for help", `hint reads "${strip.getHintText()}"`)
    await this.pinch("C14", "HelpButton")
    const help = this.main.getHelp()!
    this.check("C14", help.isOpen(), "help card did not open")
    this.check("C14", help.getLines().length === 4 && help.getLines()[3] === "Turn left and right: entryway and kitchen", `help lines: ${help.getLines().join(" | ")}`)
    this.check("C14", !card.isOpen(), "card should be closed while help is up")
    this.check("C14", strip.getHintText() === "", "first-run hint should hide once help was opened")
    await this.pinch("C14", "HelpCloseButton")
    this.check("C14", !help.isOpen(), "help still open after HelpCloseButton")

    // C13 (end): finish the four carry-along items with real pinches → "All set to leave ✓".
    for (const [id, title] of [
      ["keys", "Collect the parcel before leaving"],
      ["bag", "Pack the charger"],
      ["wallet", "Top up the metro card"],
      ["umbrella", "Carry the umbrella today"],
    ] as [string, string][]) {
      // C13 checks the note, not the hand: if the simulated hand misses a spot three times,
      // the same action is taken through the debug path and counted (see the final line).
      if (!(await this.pinch("C13", `Object-${id}`, true, true))) {
        this.fallbacks++
        app.selectObject(id, "stand-in")
        await this.wait(this.stepDelaySeconds)
      }
      const done = `DoneButton-${this.pendingId(id, title)}`
      if (!(await this.pinch("C13", done, true, true))) {
        this.fallbacks++
        card.debugPress(done)
        await this.wait(this.stepDelaySeconds)
      }
    }
    await this.wait(0.3)
    this.check("C13", leave.getLines().join("|") === "Before you leave|All set to leave ✓", `LeaveCheck after the four: ${leave.getLines().join(" | ")}`)
    await this.pinch("C13", "CloseButton")

    for (const c of CRITERIA) {
      const f = this.failures[c] ?? []
      print(`${PREFIX} ${c} ${f.length === 0 ? "PASS" : "FAIL: " + f.join("; ")}`)
    }
    print(`${PREFIX} ${this.realPinches} real SIK pinches (${this.retries} retries with a fresh simulated hand, ${this.fallbacks} C13 steps via the debug path)`)
    this.main.getSceneObject().getTransform().setWorldRotation(startRotation)
    app.resetForTest()
  }

  // ── Showcase states (screenshots) ─────────────────────────────────────────

  private async runShowcase(name: string): Promise<void> {
    const app = MemoraApp.instance
    if (!app || !this.main) return
    const card = this.main.getCard()
    const select = (id: string) => app.selectObject(id, "stand-in")
    print(`${PREFIX} showcase ${name}`)
    switch (name) {
      case "laptop-list":
        select("laptop")
        break
      case "notebook-presets":
        select("notebook")
        await this.wait(0.5)
        card.debugPress("AddButton")
        break
      case "notebook-voice":
        select("notebook")
        await this.wait(0.5)
        card.debugPress("AddButton")
        await this.wait(0.5)
        MemoraVoiceInput.instance!.submitTranscriptForTest("remind me to print the lab report")
        break
      case "laptop-details":
        select("laptop")
        await this.wait(0.5)
        card.debugPress(`MemoryRow-${this.pendingId("laptop", "Submit the project report")}`)
        break
      case "detect-keys":
        this.main.getDetection()!.simulateGazeAt("keys")
        break
      case "scan":
        this.main.getDetection()!.scan()
        break
      case "archive": {
        const milk = this.pendingId("fridge", "Buy milk on the way back")
        app.store.completeMemory(milk)
        app.store.completeMemory(this.pendingId("bag", "Pack the charger"))
        await this.wait(0.3)
        this.main.openDoneList()
        break
      }
      case "view-entryway":
        this.turnWorldToward(this.zoneCentre("entryway"))
        break
      case "view-kitchen":
        this.turnWorldToward(this.zoneCentre("kitchen"))
        break
      case "fridge-card":
        this.turnWorldToward(this.stand("fridge").getSceneObject().getTransform().getWorldPosition())
        await this.wait(0.3)
        select("fridge")
        break
      case "door-card":
        this.turnWorldToward(this.stand("door").getSceneObject().getTransform().getWorldPosition())
        await this.wait(0.3)
        select("door")
        break
      case "leave-check":
        this.turnWorldToward(this.main.getLeaveCheck()!.getSceneObject().getTransform().getWorldPosition())
        break
      case "leave-all-set":
        for (const item of app.store.leaveHomeChecklist())
          for (const m of app.store.getPendingMemoriesByObject(item.objectId)) app.store.completeMemory(m.id)
        await this.wait(0.3)
        this.turnWorldToward(this.main.getLeaveCheck()!.getSceneObject().getTransform().getWorldPosition())
        break
      case "help":
        this.main.toggleHelp()
        break
      case "medicine-details":
        this.turnWorldToward(this.stand("medicine").getSceneObject().getTransform().getWorldPosition())
        await this.wait(0.3)
        select("medicine")
        await this.wait(0.5)
        card.debugPress(`MemoryRow-${this.pendingId("medicine", "Take vitamin D after lunch")}`)
        break
    }
  }

  private zoneCentre(zoneId: string): vec3 {
    const z = findZone(zoneId)!
    const desk = this.main.spawnZone.getTransform()
    return desk.getWorldTransform().multiplyPoint(new vec3(z.anchorFromDeskCm.x, z.anchorFromDeskCm.y, z.anchorFromDeskCm.z))
  }

  /** Debug only: rotates MemoraWorld about the camera so `target` is straight ahead (screenshots of side zones). */
  /**
   * Turns MemoraWorld about the camera (the same as the user turning their head) when `target`
   * is outside the middle 80% of the view. Returns true if it turned.
   */
  private lookAt(target: vec3): boolean {
    const cam = WorldCameraFinderProvider.getInstance()
    const inner = (p: vec3) => {
      const ss = cam.worldSpaceToScreenSpace(p.x, p.y, p.z)
      return ss.x > 0.1 && ss.x < 0.9 && ss.y > 0.1 && ss.y < 0.9
    }
    if (inner(target)) return false
    // Yaw only: the desk stays level (the vertical view, 36°, already covers every MEMAR panel).
    this.turnWorldToward(target)
    return true
  }

  private turnWorldToward(target: vec3): void {
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const eye = camT.getWorldPosition()
    const f = camT.back
    const fwd = new vec3(f.x, 0, f.z).normalize()
    const d = target.sub(eye)
    const dir = new vec3(d.x, 0, d.z).normalize()
    const angle = Math.atan2(fwd.cross(dir).y, fwd.dot(dir))
    const root = this.main.getSceneObject().getTransform()
    root.setWorldRotation(quat.angleAxis(-angle, vec3.up()).multiply(root.getWorldRotation()))
  }
}
