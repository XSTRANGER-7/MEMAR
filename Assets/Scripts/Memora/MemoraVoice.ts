// MEMAR — turning a spoken sentence into a memory. Pure TypeScript, unit-tested in Node.
// The microphone side lives in the UI (Specs ASR module, started only by the Speak button).
// This file only cleans the transcript and builds the store input; nothing is saved until the
// user pinches Save on the preview.

import {TITLE_MAX} from "./MemoraStore"
import {MemoryInput, Priority} from "./MemoraTypes"

const URGENT = /\b(urgent|asap|right now|immediately|important)\b/i
const FILLER = /^(um+|uh+|er+|so|okay|ok|hey|please|remind me to|remind me|i need to|i have to|don't forget to|dont forget to)\b[\s,]*/i

/**
 * Cleans a raw ASR transcript into a short memory title: trims, collapses spaces, drops a
 * leading "remind me to" and fillers, removes trailing punctuation, capitalises the first
 * letter and cuts at a word boundary under the title limit. Returns "" for empty speech.
 */
export function cleanTranscript(raw: string | undefined | null): string {
  let text = (raw ?? "").replace(/\s+/g, " ").trim()
  for (let i = 0; i < 4; i++) {
    const next = text.replace(FILLER, "").trim()
    if (next === text) break
    text = next
  }
  text = text.replace(/[\s.!?,;:]+$/g, "").trim()
  if (text.length === 0) return ""
  if (text.length > TITLE_MAX) {
    const cut = text.slice(0, TITLE_MAX - 1)
    const space = cut.lastIndexOf(" ")
    text = (space > 20 ? cut.slice(0, space) : cut).replace(/[\s.!?,;:]+$/g, "") + "…"
  }
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Guess a priority from the words the user said; medium otherwise. */
export function priorityFromSpeech(raw: string | undefined | null): Priority {
  return URGENT.test(raw ?? "") ? "high" : "medium"
}

/**
 * Store input for a spoken memory on `objectId`, or undefined when there's nothing usable to save.
 * The object link comes from the object the user pinched, so recognitionType stays "stand-in".
 */
export function speechInput(objectId: string, raw: string | undefined | null): MemoryInput | undefined {
  const title = cleanTranscript(raw)
  if (!title) return undefined
  return {title, objectId, priority: priorityFromSpeech(raw), recognitionType: "stand-in"}
}
