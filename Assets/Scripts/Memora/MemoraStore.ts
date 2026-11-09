// MEMAR — the memory engine. Pure TypeScript, no scene objects and no Lens APIs,
// so it is unit-tested in Node (tests/) and LEAF scenarios can read it directly.
// UI components call these methods; they never touch storage records themselves.

import {findObject, isKnownObject, MEMORA_OBJECTS, objectsInZone} from "./MemoraObjects"
import {
  DueState,
  Memory,
  MemoryCounts,
  MemoryFilter,
  MemoryInput,
  MemoryPatch,
  Priority,
  Repeat,
  Result,
} from "./MemoraTypes"

export const SCHEMA_VERSION = 1
export const TITLE_MAX = 80
export const DESCRIPTION_MAX = 280
/** Same title on the same object within this window counts as a double pinch. */
export const DUPLICATE_WINDOW_MS = 1500

const PRIORITY_RANK: Record<Priority, number> = {high: 0, medium: 1, low: 2}
const PRIORITIES: Priority[] = ["low", "medium", "high"]
const REPEATS: Repeat[] = ["none", "daily", "weekly"]
const DAY_MS = 24 * 60 * 60 * 1000
const REPEAT_STEP_MS: Record<Repeat, number> = {none: 0, daily: DAY_MS, weekly: 7 * DAY_MS}

/** One line per carry-along object that still has something pending (the door's "Before you leave" check). */
export interface LeaveHomeItem {
  objectId: string
  objectName: string
  pending: number
  /** Most urgent pending title on that object. */
  firstTitle: string
}

export type Clock = () => number
export type ChangeListener = (store: MemoraStore) => void

interface SavedShape {
  schemaVersion: number
  memories: Memory[]
}

export class MemoraStore {
  private memories: Memory[] = []
  private listeners: ChangeListener[] = []
  private seq = 0
  /** Last memory completed, for the Undo toast. */
  lastCompletedId: string | undefined

  constructor(private readonly clock: Clock = () => Date.now()) {}

  // ── Change notification ────────────────────────────────────────────────────

  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(): void {
    for (const l of this.listeners) l(this)
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  validate(input: MemoryInput): string | undefined {
    const title = (input.title ?? "").trim()
    if (title.length === 0) return "Add a title before saving."
    if (title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`
    if (input.description && input.description.length > DESCRIPTION_MAX)
      return `Keep the note under ${DESCRIPTION_MAX} characters.`
    if (!isKnownObject(input.objectId)) return "Pick an object for this memory."
    if (input.priority && PRIORITIES.indexOf(input.priority) < 0) return "Unknown priority."
    if (input.dueAt !== undefined && !isFinite(input.dueAt)) return "Due date is not valid."
    if (input.repeat && REPEATS.indexOf(input.repeat) < 0) return "Unknown repeat."
    return undefined
  }

  createMemory(input: MemoryInput): Result<Memory> {
    const error = this.validate(input)
    if (error) return {ok: false, error}

    const now = this.clock()
    const title = input.title.trim()

    // Double-pinch guard: return the memory that was just saved instead of a copy.
    const dup = this.memories.find(
      (m) =>
        m.objectId === input.objectId &&
        m.title.toLowerCase() === title.toLowerCase() &&
        m.status === "pending" &&
        now - m.createdAt < DUPLICATE_WINDOW_MS,
    )
    if (dup) return {ok: true, value: dup}

    const obj = findObject(input.objectId)!
    const memory: Memory = {
      id: this.newId(now),
      title,
      description: input.description?.trim() || undefined,
      objectId: obj.id,
      objectName: obj.name,
      priority: input.priority ?? "medium",
      createdAt: now,
      updatedAt: now,
      dueAt: input.dueAt,
      status: "pending",
      recognitionType: input.recognitionType ?? "manual",
      repeat: input.repeat && input.repeat !== "none" ? input.repeat : undefined,
    }
    this.memories.push(memory)
    this.emit()
    return {ok: true, value: memory}
  }

  private newId(now: number): string {
    this.seq += 1
    const rand = Math.floor(Math.random() * 1e6).toString(36)
    return `m_${now.toString(36)}_${this.seq.toString(36)}_${rand}`
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  getMemoryById(id: string): Memory | undefined {
    return this.memories.find((m) => m.id === id)
  }

  getAllMemories(filter: MemoryFilter = {}): Memory[] {
    return this.memories
      .filter((m) => (filter.objectId ? m.objectId === filter.objectId : true))
      .filter((m) => (filter.status ? m.status === filter.status : true))
      .slice()
      .sort((a, b) => this.compare(a, b))
  }

  getMemoriesByObject(objectId: string): Memory[] {
    return this.getAllMemories({objectId})
  }

  /** What the card next to an object shows: pending only, most urgent first. */
  getPendingMemoriesByObject(objectId: string): Memory[] {
    return this.getAllMemories({objectId, status: "pending"})
  }

  pendingCountFor(objectId: string): number {
    return this.memories.filter((m) => m.objectId === objectId && m.status === "pending").length
  }

  /** Pending memories across every stand-in in a zone (drives the "Kitchen 2 ▶" hints). */
  pendingCountForZone(zoneId: string): number {
    const ids = objectsInZone(zoneId).map((o) => o.id)
    return this.memories.filter((m) => m.status === "pending" && ids.indexOf(m.objectId) >= 0).length
  }

  /** The Done archive: completed memories, most recently completed first. */
  getCompletedMemories(limit: number = Number.MAX_SAFE_INTEGER): Memory[] {
    return this.memories
      .filter((m) => m.status === "completed")
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, Math.max(0, limit))
  }

  /** Sort: pending before completed, overdue first, then priority, then due date, then oldest. */
  private compare(a: Memory, b: Memory): number {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1
    const now = this.clock()
    const ao = this.dueState(a, now) === "overdue" ? 0 : 1
    const bo = this.dueState(b, now) === "overdue" ? 0 : 1
    if (ao !== bo) return ao - bo
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    const ad = a.dueAt ?? Number.MAX_SAFE_INTEGER
    const bd = b.dueAt ?? Number.MAX_SAFE_INTEGER
    if (ad !== bd) return ad - bd
    return a.createdAt - b.createdAt
  }

  dueState(m: Memory, now: number = this.clock()): DueState {
    if (m.dueAt === undefined) return "none"
    if (m.status === "completed") return "none"
    if (m.dueAt < now) return "overdue"
    return sameLocalDay(m.dueAt, now) ? "today" : "upcoming"
  }

  getMemoryCounts(): MemoryCounts {
    const now = this.clock()
    let pending = 0
    let completed = 0
    let dueToday = 0
    let overdue = 0
    for (const m of this.memories) {
      if (m.status === "pending") {
        pending++
        const d = this.dueState(m, now)
        if (d === "today") dueToday++
        if (d === "overdue") overdue++
      } else completed++
    }
    return {total: this.memories.length, pending, completed, dueToday, overdue}
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  updateMemory(id: string, patch: MemoryPatch): Result<Memory> {
    const m = this.getMemoryById(id)
    if (!m) return {ok: false, error: "That memory no longer exists."}

    const merged: MemoryInput = {
      title: patch.title ?? m.title,
      description: patch.description ?? m.description,
      objectId: patch.objectId ?? m.objectId,
      priority: patch.priority ?? m.priority,
      dueAt: patch.dueAt === null ? undefined : patch.dueAt ?? m.dueAt,
      repeat: patch.repeat ?? m.repeat,
    }
    const error = this.validate(merged)
    if (error) return {ok: false, error}

    m.title = merged.title.trim()
    m.description = merged.description?.trim() || undefined
    if (merged.objectId !== m.objectId) {
      const obj = findObject(merged.objectId)!
      m.objectId = obj.id
      m.objectName = obj.name
    }
    m.priority = merged.priority!
    m.dueAt = merged.dueAt
    m.repeat = merged.repeat && merged.repeat !== "none" ? merged.repeat : undefined
    m.updatedAt = this.clock()
    this.emit()
    return {ok: true, value: m}
  }

  /**
   * Idempotent: a second pinch on Done does nothing and still reports success.
   * A routine memory (daily/weekly) also schedules its next occurrence, keeping the time of day.
   */
  completeMemory(id: string): Result<Memory> {
    const m = this.getMemoryById(id)
    if (!m) return {ok: false, error: "That memory no longer exists."}
    if (m.status === "completed") return {ok: true, value: m}
    const now = this.clock()
    m.status = "completed"
    m.completedAt = now
    m.updatedAt = now
    this.lastCompletedId = m.id
    if (m.repeat && m.repeat !== "none") {
      const next: Memory = {
        id: this.newId(now),
        title: m.title,
        description: m.description,
        objectId: m.objectId,
        objectName: m.objectName,
        priority: m.priority,
        createdAt: now,
        updatedAt: now,
        dueAt: nextOccurrence(m.dueAt ?? now, m.repeat, now),
        status: "pending",
        recognitionType: m.recognitionType,
        repeat: m.repeat,
      }
      m.nextId = next.id
      this.memories.push(next)
    }
    this.emit()
    return {ok: true, value: m}
  }

  /** The routine memory scheduled when `id` was completed, if it still exists. */
  getNextOccurrence(id: string): Memory | undefined {
    const m = this.getMemoryById(id)
    return m && m.nextId ? this.getMemoryById(m.nextId) : undefined
  }

  /** "Later": push a pending memory's due time `minutes` past now (or past its current due time if that's later). */
  snoozeMemory(id: string, minutes: number = 60): Result<Memory> {
    const m = this.getMemoryById(id)
    if (!m) return {ok: false, error: "That memory no longer exists."}
    if (m.status !== "pending") return {ok: false, error: "Only pending memories can be snoozed."}
    if (!(minutes > 0) || !isFinite(minutes)) return {ok: false, error: "Snooze time is not valid."}
    const now = this.clock()
    m.dueAt = Math.max(now, m.dueAt ?? now) + minutes * 60 * 1000
    m.updatedAt = now
    this.emit()
    return {ok: true, value: m}
  }

  /**
   * Carry-along things (keys, wallet, umbrella, bag, bottle) that still have something pending,
   * in catalog order. Empty means "all set to leave".
   */
  leaveHomeChecklist(): LeaveHomeItem[] {
    const out: LeaveHomeItem[] = []
    for (const o of MEMORA_OBJECTS) {
      if (!o.carry) continue
      const pending = this.getPendingMemoriesByObject(o.id)
      if (pending.length > 0) out.push({objectId: o.id, objectName: o.name, pending: pending.length, firstTitle: pending[0].title})
    }
    return out
  }

  undoCompleteMemory(id: string | undefined = this.lastCompletedId): Result<Memory> {
    if (!id) return {ok: false, error: "Nothing to undo."}
    const m = this.getMemoryById(id)
    if (!m) return {ok: false, error: "That memory no longer exists."}
    if (m.status === "pending") return {ok: true, value: m}
    m.status = "pending"
    m.completedAt = undefined
    m.updatedAt = this.clock()
    // A routine memory brought back must not leave its next occurrence behind as a duplicate.
    if (m.nextId) {
      const next = this.getMemoryById(m.nextId)
      if (next && next.status === "pending") this.memories = this.memories.filter((x) => x.id !== next.id)
      m.nextId = undefined
    }
    if (this.lastCompletedId === id) this.lastCompletedId = undefined
    this.emit()
    return {ok: true, value: m}
  }

  /** Put any completed memory back on its object (Restore in the Done archive). */
  restoreMemory(id: string): Result<Memory> {
    return this.undoCompleteMemory(id)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  deleteMemory(id: string): boolean {
    const before = this.memories.length
    this.memories = this.memories.filter((m) => m.id !== id)
    const removed = this.memories.length !== before
    if (removed) {
      if (this.lastCompletedId === id) this.lastCompletedId = undefined
      this.emit()
    }
    return removed
  }

  /** Removes every completed memory ("Clear done"). Returns how many were removed. */
  clearCompleted(): number {
    const before = this.memories.length
    this.memories = this.memories.filter((m) => m.status !== "completed")
    const removed = before - this.memories.length
    if (removed > 0) {
      this.lastCompletedId = undefined
      this.emit()
    }
    return removed
  }

  clearAll(): void {
    this.memories = []
    this.lastCompletedId = undefined
    this.emit()
  }

  // ── Serialization (used by MemoraStorage) ──────────────────────────────────

  toJSON(): string {
    const shape: SavedShape = {schemaVersion: SCHEMA_VERSION, memories: this.memories}
    return JSON.stringify(shape)
  }

  /**
   * Load saved data. Bad records are skipped, not fatal: a corrupted entry must never
   * stop the Lens from opening. Returns how many records were loaded and skipped.
   */
  loadJSON(json: string | undefined | null): {loaded: number; skipped: number; error?: string} {
    if (!json) {
      this.memories = []
      return {loaded: 0, skipped: 0}
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (e) {
      this.memories = []
      return {loaded: 0, skipped: 0, error: "Saved data was unreadable and was reset."}
    }
    const shape = parsed as Partial<SavedShape>
    if (!shape || typeof shape !== "object" || !Array.isArray(shape.memories)) {
      this.memories = []
      return {loaded: 0, skipped: 0, error: "Saved data had an unknown format and was reset."}
    }
    if ((shape.schemaVersion ?? 0) > SCHEMA_VERSION) {
      // Written by a newer build: keep it untouched in storage, run empty in memory.
      this.memories = []
      return {loaded: 0, skipped: 0, error: "Saved data is from a newer version."}
    }
    const out: Memory[] = []
    let skipped = 0
    for (const raw of shape.memories) {
      const m = sanitize(raw)
      if (m) out.push(m)
      else skipped++
    }
    this.memories = out
    this.emit()
    return {loaded: out.length, skipped}
  }
}

function sanitize(raw: unknown): Memory | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.id !== "string" || typeof r.title !== "string" || r.title.trim() === "") return undefined
  if (typeof r.objectId !== "string" || !isKnownObject(r.objectId)) return undefined
  if (typeof r.createdAt !== "number") return undefined
  const obj = findObject(r.objectId)!
  const priority = PRIORITIES.indexOf(r.priority as Priority) >= 0 ? (r.priority as Priority) : "medium"
  const status = r.status === "completed" ? "completed" : "pending"
  return {
    id: r.id,
    title: r.title.trim().slice(0, TITLE_MAX),
    description: typeof r.description === "string" ? r.description.slice(0, DESCRIPTION_MAX) : undefined,
    objectId: obj.id,
    objectName: obj.name,
    priority,
    createdAt: r.createdAt,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : r.createdAt,
    dueAt: typeof r.dueAt === "number" ? r.dueAt : undefined,
    completedAt: typeof r.completedAt === "number" ? r.completedAt : undefined,
    status,
    recognitionType:
      r.recognitionType === "stand-in" || r.recognitionType === "image-target" || r.recognitionType === "ai"
        ? r.recognitionType
        : "manual",
    repeat: r.repeat === "daily" || r.repeat === "weekly" ? r.repeat : undefined,
    nextId: typeof r.nextId === "string" ? r.nextId : undefined,
  }
}

/** Next due time for a routine memory: one step after `from`, rolled forward until it's in the future. */
export function nextOccurrence(from: number, repeat: Repeat, now: number): number {
  const step = REPEAT_STEP_MS[repeat]
  if (!(step > 0)) return from
  let next = from + step
  if (next <= now) next += Math.ceil((now - next + 1) / step) * step
  return next
}

/** Short routine label for cards: "Daily", "Weekly" or "". */
export function formatRepeat(m: Memory): string {
  return m.repeat === "daily" ? "Daily" : m.repeat === "weekly" ? "Weekly" : ""
}

export function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

/** Short due label for cards: "Overdue", "Today 5:30 PM", "Tomorrow", "12 Nov". */
export function formatDue(m: Memory, now: number): string {
  if (m.dueAt === undefined) return ""
  if (m.status === "pending" && m.dueAt < now) return "Overdue"
  const d = new Date(m.dueAt)
  const hh = d.getHours()
  const mm = d.getMinutes()
  const time = `${hh % 12 === 0 ? 12 : hh % 12}:${mm < 10 ? "0" : ""}${mm} ${hh < 12 ? "AM" : "PM"}`
  if (sameLocalDay(m.dueAt, now)) return `Today ${time}`
  if (sameLocalDay(m.dueAt, now + 24 * 60 * 60 * 1000)) return `Tomorrow ${time}`
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${d.getDate()} ${months[d.getMonth()]}`
}
