// MEMAR — scene orchestrator. Lives on the authored root "MemoraWorld".
//
// Owns: card mode (list / presets / voice / details + delete confirm), which memory
// the details view shows, and the short-lived feedback timers (Undo window, footer
// toasts). Wires engine → views (badges, today strip, card, Done list, the
// "Before you leave" note, help card) and views → engine (Done, Undo, quick-add,
// voice, priority, repeat, snooze, delete, restore).
// Objects are data-driven: every MemoraStandIn under MemoraWorld (any zone) is
// picked up by its objectId; zones are built from MEMORA_ZONES around the Desk
// (MemoraZones) and any id in MEMORA_OBJECTS without an authored "Object-<id>" is
// spawned into its zone at its offsetCm. Nothing here is specific to one object.
// Expects: the card, today strip, spawn zone and audio controller wired in the
// Inspector. MemoraApp (engine root) must sit at the top of the hierarchy.
// Size note (~700 lines): one handler per card/strip event, kept together so the
// views → engine table reads in one place; the panels, detection, archive and
// voice already live in their own modules.
// Must NOT: build UI or keep a copy of memories. The MemoraStore is the single
// source of truth; every refresh re-reads it.
// Size note (~420 lines): one handler per card event plus the feedback timers;
// formatting lives in MemoraFormat.ts, object looks in MemoraStandInCatalog.ts.

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import animate, {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import {MemoraApp} from "../Memora/MemoraApp"
import {findObject, MEMORA_OBJECTS, MEMORA_ZONES} from "../Memora/MemoraObjects"
import {presetInput, presetsFor} from "../Memora/MemoraSampleData"
import {cleanTranscript, speechInput} from "../Memora/MemoraVoice"
import {formatDue} from "../Memora/MemoraStore"
import {Priority, Repeat} from "../Memora/MemoraTypes"
import {MemoraAudioController} from "./MemoraAudioController"
import {capitalize, clip, errorOf, formatWhen, metaLine, repeatLabel, valueOf, whenPhrase} from "./MemoraFormat"
import {MemoraArchiveFlow} from "./MemoraArchiveFlow"
import {MemoraArchiveUI} from "./MemoraArchiveUI"
import {createHelpCard, MemoraHelpUI} from "./MemoraHelpUI"
import {createLeaveCheck, MemoraLeaveCheckUI} from "./MemoraLeaveCheckUI"
import {CardRow, FooterTone, MemoraCardUI, VoiceState} from "./MemoraCardUI"
import {faceToward, MemoraDetection} from "./MemoraDetection"
import {panelPlacement} from "./MemoraPlacement"
import {MemoraStandIn} from "./MemoraStandIn"
import {specFor} from "./MemoraStandInCatalog"
import {THEME} from "./MemoraThemeUI"
import {MemoraTodayStripUI} from "./MemoraTodayStripUI"
import {MemoraVoiceInput} from "./MemoraVoiceInput"
import {buildZones} from "./MemoraZones"

type CardMode = "list" | "presets" | "voice" | "details"

const NEXT_PRIORITY: Record<Priority, Priority> = {low: "medium", medium: "high", high: "low"}
const NEXT_REPEAT: Record<Repeat, Repeat> = {none: "daily", daily: "weekly", weekly: "none"}
/** Matches the "Later +1h" label on SnoozeButton. */
const SNOOZE_MINUTES = 60
const COULD_NOT_HEAR = "Couldn't hear that — try again or pick a preset"
/** Footer line on a list with nothing else to say (details hold Repeat, Later +1h, Delete). */
const ROW_HINT = "Pinch a row for details"
const SNOOZE_HINT = "Later +1h snoozes it an hour"
/** Card height used for placement: about the tallest view (presets / details), so any view fits in sight. */
const CARD_PLACE_HEIGHT_CM = 32
/** How long the open card glides when you pick another object. */
const CARD_GLIDE_SECONDS = 0.28

@component
export class MemoraMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">MemoraMain – connects the memory engine to the desk, badges and card</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The memory card (MemoryCard)")
  card!: MemoraCardUI

  @input
  @hint("Today strip on the desk edge (TodayStrip)")
  todayStrip!: MemoraTodayStripUI

  @input
  @hint("The authored Desk: the desk zone, and the parent the other zones (MEMORA_ZONES) are built relative to")
  spawnZone!: SceneObject

  @input
  @allowUndefined
  @hint("Feedback sounds (optional)")
  audioController!: MemoraAudioController
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("How long Undo stays on the card after Done (seconds). 8 s leaves time to read the card first")
  @widget(new SliderWidget(2, 10, 0.5))
  undoSeconds: number = 8

  @input
  @hint("How long \"Saved to <Object>\" stays in the footer (seconds)")
  @widget(new SliderWidget(1, 5, 0.25))
  savedToastSeconds: number = 2

  @input
  @hint("How long the quick-add list stays up after a save before returning to the list (seconds)")
  @widget(new SliderWidget(0.3, 2, 0.1))
  presetConfirmSeconds: number = 0.7

  @input
  @hint("At start, turn the desk to face where the user is looking")
  anchorToCameraOnStart: boolean = true

  @input
  @hint("Draw every stand-in hit box (debug)")
  debugColliders: boolean = false
  @ui.group_end

  private app: MemoraApp | undefined
  private standIns: MemoraStandIn[] = []
  private selectedId: string | undefined
  private mode: CardMode = "list"
  private detailId: string | undefined
  private confirming = false
  private toastText = ""
  private toastTone: FooterTone = "info"
  private toastUntil = 0
  private undoUntil = 0
  private returnToListAt = 0
  private framesUntilAnchor = -1
  private zones: Record<string, SceneObject> = {}
  private detection: MemoraDetection | undefined
  private detectOn = true
  private archive: MemoraArchiveFlow | undefined
  private voice: MemoraVoiceInput | undefined
  private voiceState: VoiceState = "listening"
  private voiceText = ""
  private voiceTranscript = ""
  private firstSelectionDone = false
  private help: MemoraHelpUI | undefined
  private helpSeen = false
  private leaveCheck: MemoraLeaveCheckUI | undefined

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  // ── Accessors for MemoraSelfTest ──────────────────────────────────────────
  getCard(): MemoraCardUI {
    return this.card
  }
  getStrip(): MemoraTodayStripUI {
    return this.todayStrip
  }
  getStandIns(): MemoraStandIn[] {
    return this.standIns
  }
  getDetection(): MemoraDetection | undefined {
    return this.detection
  }
  getArchive(): MemoraArchiveUI | undefined {
    return this.archive ? this.archive.ui : undefined
  }
  getVoice(): MemoraVoiceInput | undefined {
    return this.voice
  }
  getHelp(): MemoraHelpUI | undefined {
    return this.help
  }
  getLeaveCheck(): MemoraLeaveCheckUI | undefined {
    return this.leaveCheck
  }
  /** Same as pinching "?" on the today strip. */
  toggleHelp(): void {
    if (this.help && this.help.isOpen()) this.closeHelp()
    else this.openHelp()
  }
  /** Opens the Done list (same as the strip's Done button). */
  openDoneList(): void {
    if (this.archive && !this.archive.isOpen()) this.archive.open()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private start(): void {
    const app = MemoraApp.instance
    if (!app) {
      print("[MEMAR] MemoraApp.instance is missing. Put the MemoraApp SceneObject at the top of the hierarchy.")
      return
    }
    if (!this.card || !this.todayStrip) {
      print("[MEMAR] MemoraMain: card or todayStrip is not wired.")
      return
    }
    this.app = app
    this.zones = buildZones(this.spawnZone ?? this.getSceneObject())
    this.standIns = this.collectStandIns()
    if (this.debugColliders) for (const s of this.standIns) s.setColliderDebug(true)
    this.setUpLeaveCheck()
    this.setUpHelp()
    this.setUpDetection()
    this.setUpArchive(app)
    this.setUpVoice()

    app.store.onChange(() => this.refresh())
    app.onSelectionChanged((id) => this.onSelection(id))
    app.onSaved((ok) => {
      if (!ok) this.toast("Couldn't save", "error", 3)
    })

    const c = this.card
    c.onClose.add(() => app.clearSelection())
    c.onAdd.add(() => this.setMode("presets"))
    c.onBack.add(() => this.setMode("list"))
    c.onRowSelected.add((id) => this.openDetails(id))
    c.onDone.add((id) => this.complete(id))
    c.onUndo.add(() => this.undo())
    c.onPresetSelected.add((i) => this.savePreset(i))
    c.onPriority.add((id) => this.cyclePriority(id))
    c.onRepeat.add((id) => this.cycleRepeat(id))
    c.onSnooze.add((id) => this.snooze(id))
    c.onDelete.add(() => this.setConfirming(true))
    c.onCancelDelete.add(() => this.setConfirming(false))
    c.onConfirmDelete.add((id) => this.confirmDelete(id))
    c.onSpeak.add(() => this.startVoice())
    c.onSaveVoice.add(() => this.saveVoice())
    c.onCancelVoice.add(() => this.setMode("presets"))

    c.setUndoVisible(false)
    c.setOpen(false)
    this.refresh()
    if (app.selectedObjectId) this.onSelection(app.selectedObjectId)
    if (this.anchorToCameraOnStart) this.framesUntilAnchor = 2
  }

  private tick(): void {
    if (this.framesUntilAnchor >= 0) {
      if (this.framesUntilAnchor === 0) this.anchorToCamera()
      this.framesUntilAnchor--
    }
    const now = getTime()
    if (this.toastUntil > 0 && now >= this.toastUntil) {
      this.toastUntil = 0
      this.toastText = ""
      this.renderFooter()
    }
    if (this.undoUntil > 0 && now >= this.undoUntil) {
      this.undoUntil = 0
      if (this.card) this.card.setUndoVisible(false)
      this.renderFooter()
    }
    if (this.returnToListAt > 0 && now >= this.returnToListAt) {
      this.returnToListAt = 0
      if (this.mode === "presets") this.setMode("list")
    }
  }

  // ── Look-to-detect + Scan ─────────────────────────────────────────────────

  private setUpDetection(): void {
    const so = global.scene.createSceneObject("Detection")
    so.setParent(this.getSceneObject())
    const detection = so.createComponent(MemoraDetection.getTypeName()) as MemoraDetection
    const card = this.card
    detection.configure(this.standIns, this.audioController, [
      {root: card.getSceneObject(), widthCm: () => card.getWidthCm(), heightCm: () => card.getHeightCm(), active: () => card.isOpen()},
      {
        root: this.archivePanel(),
        widthCm: () => (this.archive ? this.archive.ui.getWidthCm() : 0),
        heightCm: () => (this.archive ? this.archive.ui.getHeightCm() : 0),
        active: () => !!this.archive && this.archive.isOpen(),
      },
      {
        root: this.help ? this.help.getSceneObject() : this.getSceneObject(),
        widthCm: () => THEME.help.widthCm,
        heightCm: () => (this.help ? this.help.getHeightCm() : 0),
        active: () => !!this.help && this.help.isOpen(),
      },
    ])
    this.detection = detection
    this.todayStrip.onScan.add(() => detection.scan())
    this.todayStrip.onDetectToggle.add(() => {
      this.detectOn = !this.detectOn
      detection.setDetectEnabled(this.detectOn)
      this.todayStrip.setDetectOn(this.detectOn)
    })
  }

  // ── Done archive ──────────────────────────────────────────────────────────

  private archiveObject: SceneObject | undefined

  /** The "ArchivePanel" SceneObject (created on first use so detection can reference it). */
  private archivePanel(): SceneObject {
    if (!this.archiveObject) {
      this.archiveObject = global.scene.createSceneObject("ArchivePanel")
      this.archiveObject.setParent(this.getSceneObject())
    }
    return this.archiveObject
  }

  private setUpArchive(app: MemoraApp): void {
    const ui = this.archivePanel().createComponent(MemoraArchiveUI.getTypeName()) as MemoraArchiveUI
    ui.configure()
    ui.setOpen(false)
    const archive = new MemoraArchiveFlow(app, ui, this.spawnZone ?? this.getSceneObject(), this.todayStrip.getSceneObject())
    this.archive = archive
    this.todayStrip.onDoneList.add(() => {
      if (!archive.isOpen()) this.closeHelp()
      archive.toggle()
    })
  }

  // ── "Before you leave" + help ─────────────────────────────────────────────

  private setUpLeaveCheck(): void {
    const entryway = this.zones.entryway
    if (!entryway) return
    this.leaveCheck = createLeaveCheck(entryway)
  }

  private setUpHelp(): void {
    const desk = this.spawnZone ?? this.getSceneObject()
    const help = createHelpCard(desk)
    help.onClose.add(() => this.closeHelp())
    this.help = help
    this.todayStrip.onHelp.add(() => this.toggleHelp())
  }

  /** Opens the help card above the laptop (in view, over no stand-in); the card and the Done list close so only one panel is up. */
  private openHelp(): void {
    const app = this.app
    const help = this.help
    if (!app || !help) return
    if (app.selectedObjectId) app.clearSelection()
    if (this.archive) this.archive.close()
    const t = help.getSceneObject().getTransform()
    t.setWorldRotation(faceToward(t.getWorldPosition(), WorldCameraFinderProvider.getInstance().getTransform().getWorldPosition()))
    help.setOpen(true)
    // The help card sits above the laptop; pause look-to-detect so its chip doesn't pop up over it.
    if (this.detection) this.detection.setDetectEnabled(false)
    if (!this.helpSeen) {
      this.helpSeen = true
      this.todayStrip.setHintVisible(false)
    }
    if (this.audioController) this.audioController.playOpen()
  }

  private closeHelp(): void {
    if (!this.help || !this.help.isOpen()) return
    this.help.setOpen(false)
    if (this.detection) this.detection.setDetectEnabled(this.detectOn)
  }

  // ── Voice capture ─────────────────────────────────────────────────────────

  private setUpVoice(): void {
    const so = global.scene.createSceneObject("Voice")
    so.setParent(this.getSceneObject())
    const voice = so.createComponent(MemoraVoiceInput.getTypeName()) as MemoraVoiceInput
    voice.onPartial.add((text) => {
      if (this.mode !== "voice" || this.voiceState !== "listening") return
      this.voiceText = text
      this.render()
    })
    voice.onFinal.add((text) => this.onVoiceFinal(text))
    voice.onError.add((message) => {
      if (this.mode !== "voice") return
      this.mode = "presets"
      this.toast(message || COULD_NOT_HEAR, "error", 6)
      this.render()
    })
    this.voice = voice
  }

  /** Speak pinched: the mic opens for one phrase. */
  private startVoice(): void {
    if (!this.selectedId || !this.voice) return
    this.mode = "voice"
    this.voiceState = "listening"
    this.voiceText = ""
    this.voiceTranscript = ""
    this.returnToListAt = 0
    this.render()
    this.voice.start()
  }

  /** A finished phrase (or the LEAF transcript hook): show the cleaned title; nothing is saved yet. */
  private onVoiceFinal(text: string): void {
    if (!this.selectedId) return
    const title = cleanTranscript(text)
    if (!title) {
      this.mode = "presets"
      this.toast(COULD_NOT_HEAR, "error", 4)
      this.render()
      return
    }
    this.mode = "voice"
    this.voiceState = "preview"
    this.voiceTranscript = text
    this.voiceText = title
    this.render()
  }

  private saveVoice(): void {
    const app = this.app
    const id = this.selectedId
    if (!app || !id) return
    const input = speechInput(id, this.voiceTranscript)
    if (!input) {
      this.toast(COULD_NOT_HEAR, "error", 4)
      return
    }
    const r = app.store.createMemory(input)
    if (!valueOf(r)) {
      this.toast(errorOf(r), "error", 3)
      return
    }
    this.mode = "list"
    if (app.lastSaveOk) {
      this.toast(`Saved to ${findObject(id)?.name ?? id}`, "success", this.savedToastSeconds)
      if (this.audioController) this.audioController.playSaved()
    }
    this.render()
  }

  // ── Stand-ins (data-driven) ───────────────────────────────────────────────

  /** Every MemoraStandIn under MemoraWorld, plus spawned ones for MEMORA_OBJECTS ids that have none. */
  private collectStandIns(): MemoraStandIn[] {
    const found: MemoraStandIn[] = []
    const walk = (o: SceneObject) => {
      for (const c of o.getComponents(MemoraStandIn.getTypeName()) as MemoraStandIn[]) found.push(c)
      for (let i = 0; i < o.getChildrenCount(); i++) walk(o.getChild(i))
    }
    walk(this.getSceneObject())

    for (const s of found) {
      if (!findObject(s.objectId)) print(`[MEMAR] ${s.getSceneObject().name}: objectId "${s.objectId}" is not in MEMORA_OBJECTS`)
    }
    for (const def of MEMORA_OBJECTS) {
      if (found.some((s) => s.objectId === def.id)) continue
      // Spawn inside the object's zone root, in the zone's own frame, so it faces the user with the zone.
      const zone = this.zones[def.zone] ?? this.spawnZone ?? this.getSceneObject()
      const c = specFor(def.id).centerCm
      const pos = new vec3(def.offsetCm.x + c[0], def.offsetCm.y + c[1], def.offsetCm.z + c[2])
      found.push(MemoraStandIn.spawn(zone, def.id, pos))
    }
    return found
  }

  // ── Engine → views ────────────────────────────────────────────────────────

  private refresh(): void {
    const app = this.app
    if (!app) return
    for (const s of this.standIns) {
      if (s.badge) s.badge.setCount(app.store.pendingCountFor(s.objectId))
    }
    const counts = app.store.getMemoryCounts()
    this.todayStrip.setCounts(counts.pending, counts.dueToday, counts.overdue)
    for (const zone of MEMORA_ZONES) {
      if (zone.id === "desk") continue
      const side = zone.anchorFromDeskCm.x < 0 ? "left" : "right"
      this.todayStrip.setZoneHint(zone.id, zone.name, app.store.pendingCountForZone(zone.id), side)
    }
    if (this.selectedId && this.card.isOpen()) this.render()
    if (this.archive && this.archive.isOpen()) this.archive.render()
    if (this.leaveCheck) this.leaveCheck.setItems(app.store.leaveHomeChecklist())
  }

  private onSelection(id: string | undefined): void {
    if (this.voice) this.voice.stop()
    if (id && this.archive) this.archive.close()
    if (id) this.closeHelp()
    if (!id) {
      this.selectedId = undefined
      this.mode = "list"
      this.confirming = false
      this.card.setOpen(false)
      return
    }
    if (!this.firstSelectionDone) {
      this.firstSelectionDone = true
      // After the first selection the first-run hint points at the help card instead.
      if (this.helpSeen) this.todayStrip.setHintVisible(false)
      else this.todayStrip.setHintText("Pinch ? for help")
    }
    const reopened = this.selectedId === id && this.card.isOpen()
    this.selectedId = id
    this.mode = "list"
    this.detailId = undefined
    this.confirming = false
    this.returnToListAt = 0
    this.placeCard(id)
    this.render()
    this.card.setOpen(true)
    if (!reopened && this.audioController) this.audioController.playOpen()
  }

  private render(): void {
    const app = this.app
    const id = this.selectedId
    if (!app || !id) return
    const name = findObject(id)?.name ?? id
    const now = Date.now()
    const pending = app.store.getPendingMemoriesByObject(id)
    const subtitle = pending.length === 0 ? "No reminders" : `${pending.length} pending`

    if (this.mode === "details") {
      const m = this.detailId ? app.store.getMemoryById(this.detailId) : undefined
      if (!m || m.status !== "pending") {
        this.mode = "list"
        this.confirming = false
      } else {
        this.card.showDetails(
          name,
          subtitle,
          {
            id: m.id,
            title: m.title,
            due: m.dueAt !== undefined ? `Due: ${formatDue(m, now)}` : "Due: no due date",
            created: `Saved: ${formatWhen(m.createdAt, now)}${m.description ? ` · ${clip(m.description, 26)}` : ""}`,
            priority: `Priority: ${capitalize(m.priority)}`,
            repeat: `Repeats: ${repeatLabel(m)}`,
          },
          this.confirming,
        )
      }
    }
    if (this.mode === "presets") {
      this.card.showPresets(name, subtitle, `Pick one, or speak your own, for the ${name.toLowerCase()}`, presetsFor(id).map((p) => p.title))
    }
    if (this.mode === "voice") {
      const listening = this.voiceState === "listening"
      this.card.showVoice(
        name,
        subtitle,
        this.voiceState,
        listening ? "● Listening…" : `Save this to the ${name.toLowerCase()}?`,
        listening ? this.voiceText || "Say what to remember" : this.voiceText,
      )
    }
    if (this.mode === "list") {
      const rows: CardRow[] = pending.map((m) => ({id: m.id, title: m.title, meta: metaLine(m, now), tone: m.priority}))
      this.card.showList(name, subtitle, rows, `Nothing on your ${name.toLowerCase()} yet`, "Pinch Add to save a quick reminder")
    }
    this.renderFooter()
  }

  private renderFooter(): void {
    const app = this.app
    if (!app || !this.card) return
    if (this.toastText) {
      this.card.setFooter(this.toastText, this.toastTone)
      return
    }
    const pending = this.selectedId ? app.store.getPendingMemoriesByObject(this.selectedId).length : 0
    const more = pending - 3
    // A quiet default line, so the footer is never an empty band and the details view is discoverable.
    let line = ""
    if (this.mode === "list" && more > 0) line = `+${more} more`
    else if (this.mode === "list" && pending > 0) line = ROW_HINT
    else if (this.mode === "details" && !this.confirming) line = SNOOZE_HINT
    this.card.setFooter(line, "info")
  }

  /**
   * Opens the card next to the object, fully inside the narrow SPECS view (see MemoraPlacement):
   * in front of the object's hit box, toward the middle of the view, badge left visible.
   */
  private placeCard(id: string): void {
    const standIn = this.standIns.find((s) => s.objectId === id)
    if (!standIn) return
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const c = specFor(id).colliderCm
    const p = panelPlacement(
      camT.getWorldPosition(),
      camT.back,
      standIn.getSceneObject().getTransform().getWorldPosition(),
      Math.max(c[0], c[1], c[2]) / 2,
      this.card.getWidthCm(),
      CARD_PLACE_HEIGHT_CM,
      this.todayStrip.getSceneObject().getTransform().getWorldPosition(),
    )
    const t = this.card.getSceneObject().getTransform()
    if (this.cancelGlide) {
      this.cancelGlide()
      this.cancelGlide = undefined
    }
    if (!this.card.isOpen()) {
      // Opening: appear in place (the card's own scale-in plays).
      t.setWorldPosition(p.pos)
      t.setWorldRotation(p.rot)
      this.card.setBaseScale(p.scale)
      return
    }
    // Already open on another object: glide over instead of jumping.
    const fromPos = t.getWorldPosition()
    const fromRot = t.getWorldRotation()
    const fromScale = this.card.getBaseScale()
    this.cancelGlide = animate({
      duration: CARD_GLIDE_SECONDS,
      easing: "ease-out-cubic",
      update: (k: number) => {
        t.setWorldPosition(vec3.lerp(fromPos, p.pos, k))
        t.setWorldRotation(quat.slerp(fromRot, p.rot, k))
        this.card.setBaseScale(fromScale + (p.scale - fromScale) * k)
      },
      ended: () => (this.cancelGlide = undefined),
    })
  }

  private cancelGlide: CancelFunction | undefined

  private anchorToCamera(): void {
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const view = camT.forward.uniformScale(-1)
    const flat = new vec3(view.x, 0, view.z)
    if (flat.length < 0.001) return
    const f = flat.normalize()
    const yaw = Math.atan2(-f.x, -f.z)
    const root = this.getSceneObject().getTransform()
    root.setWorldPosition(camT.getWorldPosition())
    root.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
    if (this.selectedId && this.card.isOpen()) this.placeCard(this.selectedId)
  }

  // ── Views → engine ────────────────────────────────────────────────────────

  private setMode(mode: CardMode): void {
    if (mode !== "voice" && this.voice) this.voice.stop()
    this.mode = mode
    this.confirming = false
    if (mode !== "presets") this.returnToListAt = 0
    this.render()
  }

  private openDetails(id: string): void {
    this.detailId = id
    this.setMode("details")
  }

  private setConfirming(on: boolean): void {
    this.confirming = on
    this.render()
  }

  private complete(id: string): void {
    const app = this.app
    if (!app) return
    const r = app.store.completeMemory(id)
    const done = valueOf(r)
    if (!done) {
      this.toast(errorOf(r), "error", 3)
      return
    }
    this.undoUntil = getTime() + this.undoSeconds
    this.card.setUndoVisible(true)
    if (this.audioController) this.audioController.playDone()
    // A routine comes back: say when, so the badge that stays at 1 makes sense.
    const next = app.store.getNextOccurrence(id)
    const text = next ? `Done · back ${whenPhrase(next, Date.now())}` : `Done · ${clip(done.title, 24)}`
    this.confirmToast(text, "success", this.undoSeconds)
  }

  private undo(): void {
    const app = this.app
    if (!app) return
    const r = app.store.undoCompleteMemory()
    this.undoUntil = 0
    this.card.setUndoVisible(false)
    if (!valueOf(r)) {
      this.toast(errorOf(r), "error", 3)
      return
    }
    this.confirmToast("Restored", "info", 2)
  }

  private savePreset(index: number): void {
    const app = this.app
    const id = this.selectedId
    if (!app || !id) return
    const preset = presetsFor(id)[index]
    if (!preset) return
    const r = app.store.createMemory(presetInput(id, preset, Date.now()))
    if (!valueOf(r)) {
      this.toast(errorOf(r), "error", 3)
      return
    }
    // onSaved(false) has already shown "Couldn't save" if the write failed; never claim a save that didn't happen.
    if (app.lastSaveOk) {
      this.toast(`Saved to ${findObject(id)?.name ?? id}`, "success", this.savedToastSeconds)
      if (this.audioController) this.audioController.playSaved()
    }
    // Stay on the list briefly so the confirmation is seen (a quick double pinch lands on the same preset; the engine keeps one).
    this.returnToListAt = getTime() + this.presetConfirmSeconds
  }

  private cyclePriority(id: string): void {
    const app = this.app
    if (!app) return
    const m = app.store.getMemoryById(id)
    if (!m) return
    const next = NEXT_PRIORITY[m.priority]
    const r = app.store.updateMemory(id, {priority: next})
    if (!valueOf(r)) {
      this.toast(errorOf(r), "error", 3)
      return
    }
    this.confirmToast(`Priority: ${capitalize(next)}`, "info", 1.5)
  }

  private cycleRepeat(id: string): void {
    const app = this.app
    if (!app) return
    const m = app.store.getMemoryById(id)
    if (!m) return
    const next = NEXT_REPEAT[m.repeat ?? "none"]
    const r = app.store.updateMemory(id, {repeat: next})
    const saved = valueOf(r)
    if (!saved) {
      this.toast(errorOf(r), "error", 3)
      return
    }
    this.confirmToast(`Repeats: ${repeatLabel(saved)}`, "info", 1.5)
  }

  /** "Later +1h": push the due time, confirm the new time, and go back to the list so it re-sorts. */
  private snooze(id: string): void {
    const app = this.app
    if (!app) return
    const r = app.store.snoozeMemory(id, SNOOZE_MINUTES)
    const saved = valueOf(r)
    if (!saved) {
      this.toast(errorOf(r), "error", 3)
      return
    }
    this.mode = "list"
    this.confirming = false
    this.detailId = undefined
    this.render()
    this.confirmToast(`Snoozed to ${whenPhrase(saved, Date.now())}`, "info", 3)
  }

  private confirmDelete(id: string): void {
    const app = this.app
    if (!app) return
    this.mode = "list"
    this.confirming = false
    this.detailId = undefined
    const removed = app.store.deleteMemory(id)
    if (removed) this.confirmToast("Deleted", "info", 2)
    else this.toast("That memory no longer exists.", "error", 3)
    this.render()
  }

  // ── Footer feedback ───────────────────────────────────────────────────────

  private toast(text: string, tone: FooterTone, seconds: number): void {
    this.toastText = text
    this.toastTone = tone
    this.toastUntil = getTime() + seconds
    this.renderFooter()
  }

  /** Positive feedback, unless the save behind it just failed (keep "Couldn't save" visible). */
  private confirmToast(text: string, tone: FooterTone, seconds: number): void {
    if (this.app && !this.app.lastSaveOk) return
    this.toast(text, tone, seconds)
  }
}
