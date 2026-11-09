// MEMAR — look-to-detect and Scan: the "SPECS notices my keys" moment, simulated
// honestly from where the user is looking (no camera recognition in Preview).
// Created at runtime by MemoraMain on the SceneObject "Detection" and set up with
// configure(); reach it from LEAF with MemoraDetection.instance.
//
// Owns: a MemoraDetector fed every frame with the camera pose and every stand-in
// except the selected one; the "DetectReticle" (corner brackets + progress dots);
// the "DetectChip" shown on lock ("Keys · 1 memory — pinch to open", pinch = open);
// the Scan sweep and its "ScanTag-<id>" labels; the user's on/off choice.
// Must NOT: read or change memories beyond counting them for labels, or open the
// card itself. A confirmed chip calls MemoraApp.selectObject(id, "stand-in") —
// the same path as pinching the object.

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {MemoraApp} from "../Memora/MemoraApp"
import {DetectionTarget, DetectorState, MemoraDetector, targetsInView, Vec3} from "../Memora/MemoraDetector"
import {findObject} from "../Memora/MemoraObjects"
import {MemoraAudioController} from "./MemoraAudioController"
import {MemoraDetectChipUI} from "./MemoraDetectChipUI"
import {createLabel, MemoraLabelUI} from "./MemoraLabelUI"
import {MemoraStandIn} from "./MemoraStandIn"
import {addMesh, specFor} from "./MemoraStandInCatalog"
import {THEME} from "./MemoraThemeUI"

/** A panel the gaze should not "see through" (the open card): bottom-centre anchored, facing +Z. */
export type GazeOccluder = {root: SceneObject; widthCm: () => number; heightCm: () => number; active: () => boolean}

type Bounds = {w: number; h: number}
/** How quickly the reticle eases to a new target (1/s); ~90% of the way in 0.16 s. */
const RETICLE_EASE = 14

function v(p: vec3): Vec3 {
  return {x: p.x, y: p.y, z: p.z}
}

/** Rotation that turns a +Z-facing panel at `pos` towards `eye` (yaw, then pitch). */
export function faceToward(pos: vec3, eye: vec3): quat {
  const d = eye.sub(pos)
  const yaw = Math.atan2(d.x, d.z)
  const pitch = -Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z))
  return quat.angleAxis(yaw, vec3.up()).multiply(quat.angleAxis(pitch, vec3.right()))
}

@component
export class MemoraDetection extends BaseScriptComponent {
  static instance: MemoraDetection | undefined

  private detector = new MemoraDetector()
  private standIns: MemoraStandIn[] = []
  private audio: MemoraAudioController | undefined
  private occluders: GazeOccluder[] = []
  private configured = false
  private enabledByUser = true

  private reticle: SceneObject | undefined
  private bars: SceneObject[] = []
  private dots: SceneObject[] = []
  private reticleFor: string | undefined
  private sweep: SceneObject | undefined
  private sweepT = -1

  private chipRoot: SceneObject | undefined
  private chip: MemoraDetectChipUI | undefined
  private chipId: string | undefined
  private chipLostFor = 0
  private chipSimulatedUntil = 0

  private tags: Record<string, MemoraLabelUI> = {}
  private scanUntil = 0
  private lastScan: string[] = []

  onAwake(): void {
    MemoraDetection.instance = this
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  configure(standIns: MemoraStandIn[], audio: MemoraAudioController | undefined, occluders: GazeOccluder[]): void {
    if (this.configured) return
    this.configured = true
    this.standIns = standIns
    this.audio = audio
    this.occluders = occluders
    this.buildReticle()
    this.buildChip()
    this.buildScan()
    this.detector.onLocked((id) => this.onLocked(id))
    const app = MemoraApp.instance
    if (app) app.onSelectionChanged(() => this.hideChip())
  }

  // ── Public API (MemoraMain, LEAF) ─────────────────────────────────────────

  setDetectEnabled(on: boolean): void {
    this.enabledByUser = on
    this.detector.setEnabled(on)
    if (!on) {
      this.showReticle(false)
      this.hideChip()
    }
  }

  isDetectEnabled(): boolean {
    return this.enabledByUser
  }

  /** LEAF hook: runs the same lock path as a real dwell on `objectId`, without moving the camera. */
  simulateGazeAt(objectId: string): boolean {
    const s = this.standInFor(objectId)
    if (!s) return false
    this.drawReticleAt(s, 1)
    this.chipSimulatedUntil = getTime() + THEME.detect.simulatedChipSeconds
    this.onLocked(objectId)
    return true
  }

  /** Pinch on the chip: open that object's card (same as pinching the object). */
  confirmChip(): void {
    const id = this.chipId
    const app = MemoraApp.instance
    if (!id || !app) return
    app.selectObject(id, "stand-in")
  }

  /** Sweep, then tag every stand-in in view with its pending count for a few seconds. */
  scan(): void {
    if (this.sweepT >= 0) return
    if (this.audio) this.audio.playScan()
    this.sweepT = 0
    if (this.sweep) this.sweep.enabled = true
  }

  // ── Test helpers ──────────────────────────────────────────────────────────
  getState(): DetectorState {
    return this.detector.getState()
  }
  chipObjectId(): string | undefined {
    return this.chip && this.chip.isShown() ? this.chipId : undefined
  }
  chipText(): string {
    return this.chip ? this.chip.getText() : ""
  }
  reticleShown(): boolean {
    return !!this.reticle && this.reticle.enabled
  }
  shownScanTags(): string[] {
    return Object.keys(this.tags).filter((id) => this.tags[id].isShown())
  }
  scanTagText(id: string): string {
    return this.tags[id] ? this.tags[id].getText() : ""
  }

  // ── Frame loop ────────────────────────────────────────────────────────────

  private tick(): void {
    if (!this.configured) return
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const eye = camT.getWorldPosition()
    const fwd = camT.back
    const dt = getDeltaTime()
    this.tickScan(eye, fwd, dt)
    this.faceCamera(eye)
    if (!this.enabledByUser) return

    this.detector.setTargets(this.targets(true))
    let state: DetectorState
    if (this.gazeBlocked(eye, fwd)) {
      this.detector.reset()
      state = this.detector.getState()
    } else {
      state = this.detector.update(v(eye), v(fwd), dt)
    }
    this.drawReticle(state)

    if (this.chipId) {
      const looking = state.phase === "locked" && state.targetId === this.chipId
      if (looking || getTime() < this.chipSimulatedUntil) this.chipLostFor = 0
      else {
        this.chipLostFor += dt
        if (this.chipLostFor > THEME.detect.chipLookAwaySeconds) this.hideChip()
      }
    }
  }

  private targets(excludeSelected: boolean): DetectionTarget[] {
    const app = MemoraApp.instance
    const selected = excludeSelected && app ? app.selectedObjectId : undefined
    const out: DetectionTarget[] = []
    for (const s of this.standIns) {
      if (!s.objectId || s.objectId === selected) continue
      const c = specFor(s.objectId).colliderCm
      out.push({id: s.objectId, center: v(s.getSceneObject().getTransform().getWorldPosition()), radiusCm: 0.5 * Math.max(c[0], c[1], c[2])})
    }
    return out
  }

  /** True when the gaze ray hits an open panel (e.g. the card) before reaching an object. */
  private gazeBlocked(eye: vec3, fwd: vec3): boolean {
    for (const o of this.occluders) {
      if (!o.active()) continue
      const t = o.root.getTransform()
      const n = t.forward
      const denom = fwd.dot(n)
      if (Math.abs(denom) < 1e-4) continue
      const dist = t.getWorldPosition().sub(eye).dot(n) / denom
      if (dist <= 0) continue
      const local = t.getInvertedWorldTransform().multiplyPoint(eye.add(fwd.uniformScale(dist)))
      if (Math.abs(local.x) <= o.widthCm() / 2 && local.y >= 0 && local.y <= o.heightCm()) return true
    }
    return false
  }

  private onLocked(id: string): void {
    const app = MemoraApp.instance
    if (!this.enabledByUser || !app || id === app.selectedObjectId) return
    const s = this.standInFor(id)
    if (!s || !this.chip || !this.chipRoot) return
    const n = app.store.pendingCountFor(id)
    const name = findObject(id)?.name ?? id
    this.chip.setText(n > 0 ? `${name} · ${n} ${n === 1 ? "memory" : "memories"} — pinch to open` : `${name} · nothing yet — pinch to add`)
    this.chipRoot.getTransform().setWorldPosition(this.chipPosition(s))
    this.chipId = id
    this.chipLostFor = 0
    this.chip.setVisible(true)
    if (this.audio) this.audio.playFound()
  }

  private hideChip(): void {
    this.chipId = undefined
    this.chipSimulatedUntil = 0
    if (this.chip) this.chip.setVisible(false)
  }

  /** Above small things (clear of the badge); in front of the upper part of tall things. */
  private chipPosition(s: MemoraStandIn): vec3 {
    const t = s.getSceneObject().getTransform()
    const spec = specFor(s.objectId)
    const tall = spec.colliderCm[1] > 60
    if (tall) {
      const local = new vec3(0, 24, spec.colliderCm[2] / 2 + 4)
      return t.getWorldTransform().multiplyPoint(local)
    }
    const b = spec.badgeCm
    return t.getWorldTransform().multiplyPoint(new vec3(b[0], b[1] + THEME.badge.diameterCm / 2 + THEME.detect.chipHeightCm / 2 + 1.2, b[2]))
  }

  // ── Reticle ───────────────────────────────────────────────────────────────

  private buildReticle(): void {
    const root = global.scene.createSceneObject("DetectReticle")
    root.setParent(this.sceneObject)
    for (let i = 0; i < 8; i++) {
      const bar = global.scene.createSceneObject(`Bracket${i}`)
      bar.setParent(root)
      addMesh(bar, "box", "reticle", new vec3(1, 1, 1))
      this.bars.push(bar)
    }
    const n = THEME.detect.ringDots
    for (let i = 0; i < n; i++) {
      const dot = global.scene.createSceneObject(`ProgressDot${i}`)
      dot.setParent(root)
      addMesh(dot, "box", "reticle", new vec3(0.55, 0.55, 0.1))
      this.dots.push(dot)
    }
    root.enabled = false
    this.reticle = root
  }

  private showReticle(on: boolean): void {
    if (this.reticle) this.reticle.enabled = on
    if (!on) {
      this.reticleFor = undefined
      this.retPos = undefined
    }
  }

  // Smoothed reticle pose: it glides and resizes between targets instead of jumping.
  private retPos: vec3 | undefined
  private retW = 0
  private retH = 0
  private retTime = 0

  private drawReticle(state: DetectorState): void {
    if (state.phase === "idle" || !state.targetId) {
      if (getTime() >= this.chipSimulatedUntil) this.showReticle(false)
      return
    }
    const s = this.standInFor(state.targetId)
    if (!s) return
    this.drawReticleAt(s, state.progress)
  }

  private drawReticleAt(s: MemoraStandIn, progress: number): void {
    if (!this.reticle) return
    const target = s.getSceneObject().getTransform().getWorldPosition()
    const b = this.boundsFor(s)
    const now = getTime()
    if (!this.reticle.enabled || !this.retPos) {
      // Appearing: start where the target is (no fly-in from an old spot).
      this.retPos = target
      this.retW = b.w
      this.retH = b.h
    } else {
      const dt = Math.min(0.1, Math.max(0, now - this.retTime))
      const k = 1 - Math.exp(-dt * RETICLE_EASE)
      this.retPos = vec3.lerp(this.retPos, target, k)
      this.retW += (b.w - this.retW) * k
      this.retH += (b.h - this.retH) * k
    }
    this.retTime = now
    this.layoutBrackets({w: this.retW, h: this.retH})
    this.reticleFor = s.objectId
    this.reticle.getTransform().setWorldPosition(this.retPos)
    const lit = Math.round(progress * this.dots.length)
    for (let i = 0; i < this.dots.length; i++) this.dots[i].enabled = i < lit
    this.reticle.enabled = true
  }

  private boundsFor(s: MemoraStandIn): Bounds {
    const c = specFor(s.objectId).colliderCm
    const m = THEME.detect.bracketMarginCm
    // Seen from eye height, a flat object's depth shows as part of its height.
    return {w: Math.max(6, Math.max(c[0], c[2]) + m), h: Math.max(6, Math.max(c[1], c[2] * 0.6) + m)}
  }

  /** Four L-shaped corners around a w x h box, plus the progress ring at the top-right corner. */
  private layoutBrackets(b: Bounds): void {
    const th = THEME.detect.bracketThicknessCm
    const len = Math.max(1.5, Math.min(b.w, b.h) * 0.22)
    const hx = b.w / 2
    const hy = b.h / 2
    const corners: [number, number][] = [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ]
    corners.forEach(([sx, sy], i) => {
      const horiz = this.bars[i * 2].getTransform()
      horiz.setLocalPosition(new vec3(sx * (hx - len / 2), sy * hy, 0))
      horiz.setLocalScale(new vec3(len, th, th))
      const vert = this.bars[i * 2 + 1].getTransform()
      vert.setLocalPosition(new vec3(sx * hx, sy * (hy - len / 2), 0))
      vert.setLocalScale(new vec3(th, len, th))
    })
    const r = THEME.detect.ringRadiusCm
    const cx = hx + r + 1
    const cy = hy + r + 1
    this.dots.forEach((dot, i) => {
      const a = Math.PI / 2 - (i / this.dots.length) * Math.PI * 2 // clockwise from 12 o'clock
      dot.getTransform().setLocalPosition(new vec3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0))
    })
  }

  private faceCamera(eye: vec3): void {
    if (this.reticle && this.reticle.enabled) {
      const t = this.reticle.getTransform()
      t.setWorldRotation(faceToward(t.getWorldPosition(), eye))
    }
    if (this.chipRoot && this.chip && this.chip.isShown()) {
      const t = this.chipRoot.getTransform()
      t.setWorldRotation(faceToward(t.getWorldPosition(), eye))
    }
    for (const id of Object.keys(this.tags)) {
      const tag = this.tags[id]
      if (!tag.isShown()) continue
      const t = tag.getSceneObject().getTransform()
      t.setWorldRotation(faceToward(t.getWorldPosition(), eye))
    }
  }

  // ── Chip ──────────────────────────────────────────────────────────────────

  private buildChip(): void {
    const root = global.scene.createSceneObject("DetectChipRoot")
    root.setParent(this.sceneObject)
    const chip = root.createComponent(MemoraDetectChipUI.getTypeName()) as MemoraDetectChipUI
    chip.configure()
    chip.onPressed.add(() => this.confirmChip())
    chip.setVisible(false)
    this.chipRoot = root
    this.chip = chip
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  private buildScan(): void {
    const sweep = global.scene.createSceneObject("ScanSweep")
    sweep.setParent(this.sceneObject)
    addMesh(sweep, "box", "reticle", new vec3(0.5, 46, 0.2))
    sweep.enabled = false
    this.sweep = sweep
    for (const s of this.standIns) {
      if (!s.objectId) continue
      const spec = specFor(s.objectId)
      const b = spec.badgeCm
      const tag = createLabel(
        s.getSceneObject(),
        `ScanTag-${s.objectId}`,
        new vec3(b[0], b[1] + THEME.badge.diameterCm / 2 + 3, b[2]),
        "",
        13,
        3.8,
        THEME.label.scanTag,
      )
      tag.setVisible(false)
      this.tags[s.objectId] = tag
    }
  }

  private tickScan(eye: vec3, fwd: vec3, dt: number): void {
    if (this.sweepT >= 0 && this.sweep) {
      this.sweepT += dt
      const k = Math.min(1, this.sweepT / THEME.detect.sweepSeconds)
      const right = vec3.up().cross(fwd).normalize().uniformScale(-1)
      const pos = eye.add(fwd.uniformScale(70)).add(right.uniformScale(-36 + 72 * k))
      const t = this.sweep.getTransform()
      t.setWorldPosition(pos)
      t.setWorldRotation(faceToward(pos, eye))
      if (k >= 1) {
        this.sweepT = -1
        this.sweep.enabled = false
        this.showScanTags(eye, fwd)
      }
    }
    if (this.scanUntil > 0 && getTime() >= this.scanUntil) {
      this.scanUntil = 0
      for (const id of Object.keys(this.tags)) this.tags[id].setVisible(false)
    }
  }

  private showScanTags(eye: vec3, fwd: vec3): void {
    const app = MemoraApp.instance
    if (!app) return
    const inView = targetsInView(v(eye), v(fwd), this.targets(false), THEME.detect.scanHalfAngleDeg)
    this.lastScan = inView
    for (const id of Object.keys(this.tags)) {
      const tag = this.tags[id]
      const show = inView.indexOf(id) >= 0
      if (show) tag.setText(`${findObject(id)?.shortLabel ?? id} · ${app.store.pendingCountFor(id)}`)
      tag.setVisible(show)
    }
    this.scanUntil = getTime() + THEME.detect.scanTagSeconds
  }

  /** Ids tagged by the most recent scan (test helper). */
  lastScanIds(): string[] {
    return this.lastScan.slice()
  }

  private standInFor(id: string): MemoraStandIn | undefined {
    return this.standIns.filter((s) => s.objectId === id)[0]
  }
}
