// MEMAR — shared types. Pure TypeScript: no Lens Studio APIs, so the same file
// compiles in Lens Studio and in the Node test harness (tests/).

export type Priority = "low" | "medium" | "high"
export type MemoryStatus = "pending" | "completed"
/** Routine memories come back after Done: "daily" (next day), "weekly" (same day next week). */
export type Repeat = "none" | "daily" | "weekly"
/**
 * How the memory got linked to its object.
 * - "manual":   user picked the object (the only path that works in Preview)
 * - "stand-in": user pinched the virtual stand-in object ("found it" moment)
 * - "image-target" / "ai": reserved for real recognition on glasses (Release 2+)
 */
export type RecognitionType = "manual" | "stand-in" | "image-target" | "ai"

export interface Memory {
  id: string
  title: string
  description?: string
  objectId: string
  objectName: string
  priority: Priority
  /** Unix ms */
  createdAt: number
  updatedAt: number
  dueAt?: number
  completedAt?: number
  status: MemoryStatus
  recognitionType: RecognitionType
  /** Routine memories; undefined = one-off. */
  repeat?: Repeat
  /** On a completed routine memory: the id of the next occurrence it created (so Undo/Restore can remove it). */
  nextId?: string
}

export interface MemoryInput {
  title: string
  description?: string
  objectId: string
  priority?: Priority
  dueAt?: number
  recognitionType?: RecognitionType
  repeat?: Repeat
}

export interface MemoryPatch {
  title?: string
  description?: string
  objectId?: string
  priority?: Priority
  /** null clears the due date */
  dueAt?: number | null
  repeat?: Repeat
}

export type DueState = "none" | "overdue" | "today" | "upcoming"

export interface MemoryCounts {
  total: number
  pending: number
  completed: number
  dueToday: number
  overdue: number
}

export interface MemoryFilter {
  objectId?: string
  status?: MemoryStatus
}

/** Result type so the UI can show a clear message instead of catching exceptions. */
export type Result<T> = {ok: true; value: T} | {ok: false; error: string}
