// MEMAR — text formatting and Result helpers for the card. Plain module.
// Owns: how dates, priorities and engine Results read on screen.
// Must NOT: hold state or touch the scene.

import {formatDue, formatRepeat, sameLocalDay} from "../Memora/MemoraStore"
import {Memory, Result} from "../Memora/MemoraTypes"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_MS = 24 * 60 * 60 * 1000

/** The saved memory, or undefined when the engine refused the change. */
export function valueOf(r: Result<Memory>): Memory | undefined {
  return r.ok ? (r as {ok: true; value: Memory}).value : undefined
}

/** The engine's user-facing error text for a refused change. */
export function errorOf(r: Result<Memory>): string {
  return r.ok ? "" : (r as {ok: false; error: string}).error
}

export function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+$/, "") + "…"
}

export function clock(ts: number): string {
  const d = new Date(ts)
  const hh = d.getHours()
  const mm = d.getMinutes()
  return `${hh % 12 === 0 ? 12 : hh % 12}:${mm < 10 ? "0" : ""}${mm} ${hh < 12 ? "AM" : "PM"}`
}

/** "Today 11:20 AM", "Yesterday 6:05 PM", "8 Nov". */
export function formatWhen(ts: number, now: number): string {
  if (sameLocalDay(ts, now)) return `Today ${clock(ts)}`
  if (sameLocalDay(ts, now - DAY_MS)) return `Yesterday ${clock(ts)}`
  const d = new Date(ts)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Row subtitle: "High · Today 6:00 PM", plus " · Daily" / " · Weekly" for routines. */
export function metaLine(m: Memory, now: number): string {
  const due = m.dueAt !== undefined ? formatDue(m, now) : "No due date"
  const repeat = formatRepeat(m)
  return `${capitalize(m.priority)} · ${due}${repeat ? ` · ${repeat}` : ""}`
}

/** "3:10 PM" today, "tomorrow 9:00 AM", or "12 Nov" — for snooze / routine toasts. */
export function whenPhrase(m: Memory, now: number): string {
  if (m.dueAt === undefined) return "later"
  if (sameLocalDay(m.dueAt, now)) return clock(m.dueAt)
  const label = formatDue(m, now)
  return label.indexOf("Tomorrow") === 0 ? "t" + label.slice(1) : label
}

/** "Daily" / "Weekly" / "Once". */
export function repeatLabel(m: Memory): string {
  return formatRepeat(m) || "Once"
}
