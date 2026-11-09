// MEMAR — look-to-recall detector. Pure TypeScript (no Lens APIs), unit-tested in Node.
//
// In Lens Studio Preview the glasses can't recognise real things, so MEMAR simulates the
// "the glasses noticed my laptop" moment from where the user is looking: each stand-in is a
// sphere target, and a short dwell of the head's gaze ray on one locks it. A lock is a
// *suggestion*: the UI shows a small chip and the user confirms with a pinch before the card
// opens (same rule a real camera recogniser will follow). On SPECS hardware a camera-based
// recogniser replaces this class and calls the same MemoraApp.selectObject(id, via).

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface DetectionTarget {
  id: string
  /** World position of the target's centre, cm. */
  center: Vec3
  /** Rough radius of the object, cm. Bigger things are easier to aim at. */
  radiusCm: number
}

export interface DetectorConfig {
  /** Seconds of steady gaze before a target locks. */
  dwellSeconds: number
  /** Extra aim tolerance around the object's own angular size, degrees. */
  toleranceDeg: number
  /** Ignore things closer or farther than this, cm. */
  minDistanceCm: number
  maxDistanceCm: number
  /** Gaze may slip off a target this long without losing progress, seconds. */
  graceSeconds: number
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  dwellSeconds: 0.9,
  toleranceDeg: 4,
  minDistanceCm: 15,
  maxDistanceCm: 400,
  graceSeconds: 0.25,
}

export type DetectorPhase = "idle" | "tracking" | "locked"

export interface DetectorState {
  phase: DetectorPhase
  /** Target being tracked or locked. */
  targetId?: string
  /** Dwell progress 0..1 (1 when locked). */
  progress: number
  /** How centred the gaze is on the target, 0..1 (1 = dead centre). Drives the reticle, not a claim of ML confidence. */
  aim: number
}

export type LockListener = (targetId: string) => void

export interface GazeHit {
  id: string
  /** Angle between the gaze and the target's edge, degrees (0 when the gaze ray passes through it). */
  edgeAngleDeg: number
  distanceCm: number
  aim: number
}

const RAD = 180 / Math.PI

function sub(a: Vec3, b: Vec3): Vec3 {
  return {x: a.x - b.x, y: a.y - b.y, z: a.z - b.z}
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function len(a: Vec3): number {
  return Math.sqrt(dot(a, a))
}

/**
 * Every target the gaze ray from `eye` along `forward` is aimed at (within its angular size plus
 * `toleranceDeg`), best aimed first. `forward` does not need to be normalised.
 */
export function gazeHits(
  eye: Vec3,
  forward: Vec3,
  targets: DetectionTarget[],
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
): GazeHit[] {
  const fl = len(forward)
  if (!(fl > 0)) return []
  const hits: GazeHit[] = []
  for (const t of targets) {
    const v = sub(t.center, eye)
    const d = len(v)
    if (!(d >= config.minDistanceCm && d <= config.maxDistanceCm)) continue
    const cos = Math.max(-1, Math.min(1, dot(v, forward) / (d * fl)))
    const centreAngle = Math.acos(cos) * RAD
    const angularRadius = Math.atan(Math.max(0, t.radiusCm) / d) * RAD
    const edgeAngle = Math.max(0, centreAngle - angularRadius)
    if (edgeAngle > config.toleranceDeg) continue
    const limit = angularRadius + config.toleranceDeg
    const aim = limit > 0 ? Math.max(0, Math.min(1, 1 - centreAngle / limit)) : 1
    hits.push({id: t.id, edgeAngleDeg: edgeAngle, distanceCm: d, aim})
  }
  // Prefer the target the ray goes through most centrally; break ties by nearer object.
  hits.sort((a, b) => a.edgeAngleDeg - b.edgeAngleDeg || b.aim - a.aim || a.distanceCm - b.distanceCm)
  return hits
}

/**
 * Targets inside a view cone (half-angle `halfAngleDeg`), nearest to the view centre first.
 * Used by "Scan area" to tag everything currently in view.
 */
export function targetsInView(
  eye: Vec3,
  forward: Vec3,
  targets: DetectionTarget[],
  halfAngleDeg: number,
  maxDistanceCm: number = DEFAULT_DETECTOR_CONFIG.maxDistanceCm,
): string[] {
  const fl = len(forward)
  if (!(fl > 0)) return []
  const inView: {id: string; angle: number}[] = []
  for (const t of targets) {
    const v = sub(t.center, eye)
    const d = len(v)
    if (!(d > 0 && d <= maxDistanceCm)) continue
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(v, forward) / (d * fl)))) * RAD
    if (angle <= halfAngleDeg) inView.push({id: t.id, angle})
  }
  inView.sort((a, b) => a.angle - b.angle)
  return inView.map((x) => x.id)
}

export class MemoraDetector {
  private targets: DetectionTarget[] = []
  private listeners: LockListener[] = []
  private state: DetectorState = {phase: "idle", progress: 0, aim: 0}
  private lostFor = 0
  private enabled = true

  constructor(private readonly config: DetectorConfig = DEFAULT_DETECTOR_CONFIG) {}

  setTargets(targets: DetectionTarget[]): void {
    this.targets = targets.slice()
    if (this.state.targetId && !this.targets.some((t) => t.id === this.state.targetId)) this.reset()
  }

  /** Pause detection (e.g. while a card is open) without losing targets. */
  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) this.reset()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  onLocked(listener: LockListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  getState(): DetectorState {
    return {...this.state}
  }

  reset(): void {
    this.state = {phase: "idle", progress: 0, aim: 0}
    this.lostFor = 0
  }

  /**
   * Advance one frame. A target locks once per gaze episode: after locking it stays "locked"
   * while the user keeps looking, and can lock again only after the gaze leaves it.
   */
  update(eye: Vec3, forward: Vec3, dt: number): DetectorState {
    if (!this.enabled) return this.getState()
    const step = isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0
    const best = gazeHits(eye, forward, this.targets, this.config)[0]
    const current = this.state.targetId

    if (best && best.id === current) {
      this.lostFor = 0
      this.state.aim = best.aim
      if (this.state.phase === "tracking") {
        this.state.progress = Math.min(1, this.state.progress + step / this.config.dwellSeconds)
        if (this.state.progress >= 1) {
          this.state.phase = "locked"
          for (const l of this.listeners.slice()) l(best.id)
        }
      }
      return this.getState()
    }

    if (current && (!best || best.id !== current)) {
      // Gaze slipped off the current target: keep it briefly so a jittery head doesn't reset it.
      this.lostFor += step
      if (this.lostFor <= this.config.graceSeconds && !best) return this.getState()
      this.reset()
    }

    if (best) {
      this.state = {phase: "tracking", targetId: best.id, progress: 0, aim: best.aim}
      this.lostFor = 0
    }
    return this.getState()
  }
}
