// MEMAR — demo data. Typing on glasses is slow and voice may not work in Preview,
// so new memories are created from quick presets per object (the demo stand-in for
// voice capture). The seed gives the demo something to recall on first launch.

import type {MemoraStore} from "./MemoraStore"
import {MemoryInput, Priority, Repeat} from "./MemoraTypes"

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

export interface QuickPreset {
  title: string
  priority: Priority
  /** Due offset from "now" in hours; undefined = no due date. */
  dueInHours?: number
  /** Routine presets come back after Done. */
  repeat?: Repeat
}

export const QUICK_PRESETS: Record<string, QuickPreset[]> = {
  laptop: [
    {title: "Submit the project report", priority: "high", dueInHours: 6},
    {title: "Back up the thesis folder", priority: "medium"},
    {title: "Reply to the internship email", priority: "medium", dueInHours: 24},
  ],
  keys: [
    {title: "Collect the parcel before leaving", priority: "high", dueInHours: 3},
    {title: "Lock the bike shed", priority: "low"},
  ],
  notebook: [
    {title: "Review meeting action items", priority: "medium", dueInHours: 24},
    {title: "Copy formulas for tomorrow's exam", priority: "high", dueInHours: 12},
  ],
  bag: [
    {title: "Pack the charger", priority: "high"},
    {title: "Return the library book", priority: "medium", dueInHours: 48},
  ],
  door: [
    {title: "Switch off the lights before leaving", priority: "medium", repeat: "daily"},
    {title: "Lock the door and check the windows", priority: "high"},
  ],
  wallet: [
    {title: "Top up the metro card", priority: "medium", dueInHours: 24},
    {title: "Keep cash for the auto ride", priority: "low"},
  ],
  umbrella: [
    {title: "Carry the umbrella today", priority: "high", dueInHours: 4},
    {title: "Return the borrowed umbrella", priority: "low", dueInHours: 48},
  ],
  fridge: [
    {title: "Buy milk on the way back", priority: "medium", dueInHours: 8},
    {title: "Finish the leftovers", priority: "medium", dueInHours: 24},
  ],
  medicine: [
    {title: "Take vitamin D after lunch", priority: "high", dueInHours: 2, repeat: "daily"},
    {title: "Refill the prescription", priority: "medium", dueInHours: 72},
  ],
  bottle: [
    {title: "Refill the water bottle", priority: "low", repeat: "daily"},
    {title: "Drink two litres of water today", priority: "medium", dueInHours: 10},
  ],
  other: [{title: "Call home", priority: "low"}],
}

/** Presets for one object; empty list for an unknown id. */
export function presetsFor(objectId: string): QuickPreset[] {
  return QUICK_PRESETS[objectId] ?? []
}

/** Turns a preset the user pinched into the input for store.createMemory(). */
export function presetInput(objectId: string, preset: QuickPreset, now: number): MemoryInput {
  return {
    title: preset.title,
    objectId,
    priority: preset.priority,
    dueAt: preset.dueInHours === undefined ? undefined : now + preset.dueInHours * HOUR,
    recognitionType: "stand-in",
    repeat: preset.repeat,
  }
}

/**
 * A due time `hours` from now, kept inside today (11:30 PM at the latest), so the seeded
 * memories read "Today ..." and count as "due today" whatever time the demo runs.
 * In the last 15 minutes before 11:30 PM it falls back to 15 minutes from now.
 */
export function dueLaterToday(now: number, hours: number): number {
  const lastSlot = new Date(now)
  lastSlot.setHours(23, 30, 0, 0)
  const target = now + hours * HOUR
  if (target <= lastSlot.getTime()) return target
  if (lastSlot.getTime() - now >= 15 * MINUTE) return lastSlot.getTime()
  return now + 15 * MINUTE
}

/**
 * Seed shown on a fresh install so the first recall isn't empty: the desk moment from the brief
 * (laptop 2, keys 1, bag 1, notebook 0) plus a couple of memories in each other zone.
 */
export function demoSeed(now: number): MemoryInput[] {
  return [
    {title: "Submit the project report", objectId: "laptop", priority: "high", dueAt: dueLaterToday(now, 6), recognitionType: "manual"},
    {title: "Reply to the internship email", objectId: "laptop", priority: "medium", recognitionType: "manual"},
    {title: "Collect the parcel before leaving", objectId: "keys", priority: "high", dueAt: dueLaterToday(now, 3), recognitionType: "manual"},
    {title: "Pack the charger", objectId: "bag", priority: "high", recognitionType: "manual"},
    {title: "Carry the umbrella today", objectId: "umbrella", priority: "high", recognitionType: "manual"},
    {title: "Top up the metro card", objectId: "wallet", priority: "medium", recognitionType: "manual"},
    {title: "Take vitamin D after lunch", objectId: "medicine", priority: "high", dueAt: dueLaterToday(now, 2), recognitionType: "manual", repeat: "daily"},
    {title: "Buy milk on the way back", objectId: "fridge", priority: "medium", recognitionType: "manual"},
  ]
}

/**
 * Bump when the seed gains memories for new objects. A device that already has memories
 * from an older seed gets only the starters for objects it has never had a memory on.
 * 1 = desk only; 2 = desk + entryway + kitchen.
 */
export const DEMO_SEED_VERSION = 2

/**
 * Seed entries for objects that have no memories at all (pending or completed) in `store`.
 * Never brings back something the user completed or deleted on an object they already use.
 */
export function seedForNewObjects(store: MemoraStore, now: number): MemoryInput[] {
  return demoSeed(now).filter((input) => store.getMemoriesByObject(input.objectId).length === 0)
}

/** What the demo seed puts on each object, for tests and LEAF checks. */
export const DEMO_SEED_COUNTS: Record<string, number> = {
  laptop: 2,
  keys: 1,
  notebook: 0,
  bag: 1,
  door: 0,
  wallet: 1,
  umbrella: 1,
  fridge: 1,
  medicine: 1,
  bottle: 0,
}
