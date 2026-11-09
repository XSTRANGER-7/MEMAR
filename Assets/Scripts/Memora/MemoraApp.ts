// MEMAR — app root. Put this on one SceneObject named "MemoraApp".
// It owns the single MemoraStore, wires storage, seeds demo data on a fresh install,
// and tracks which object is selected. UI scripts (built by CLAD) and LEAF scenarios
// reach it with MemoraApp.instance.
//
// Object selection is the seam for recognition:
//   Preview:        pinching a stand-in object calls selectObject(id, "stand-in")
//   Real glasses:   an image-target / AI adapter calls selectObject(id, "image-target")
//                   only after the user confirms the detected object.

import {MemoraStore} from "./MemoraStore"
import {bindStorage, createStorageAdapter, SEED_VERSION_KEY, StorageAdapter} from "./MemoraStorage"
import {DEMO_SEED_VERSION, demoSeed, seedForNewObjects} from "./MemoraSampleData"
import {findObject} from "./MemoraObjects"
import {RecognitionType} from "./MemoraTypes"

type SelectionListener = (objectId: string | undefined, via: RecognitionType | undefined) => void
type SaveListener = (ok: boolean) => void

@component
export class MemoraApp extends BaseScriptComponent {
  @input
  @hint("Seed four sample memories when storage is empty (keeps the first recall from being blank)")
  seedDemoData: boolean = true

  @input
  @hint("Start empty every launch. Use while recording takes or running LEAF")
  resetOnStart: boolean = false

  static instance: MemoraApp | undefined

  readonly store = new MemoraStore()
  storage: StorageAdapter | undefined
  selectedObjectId: string | undefined
  lastLoadMessage: string | undefined
  lastSaveOk = true

  private selectionListeners: SelectionListener[] = []
  private saveListeners: SaveListener[] = []

  onAwake(): void {
    MemoraApp.instance = this
    this.storage = createStorageAdapter()
    if (this.resetOnStart) this.storage.clear()

    const result = bindStorage(this.store, this.storage, (ok) => {
      this.lastSaveOk = ok
      for (const l of this.saveListeners) l(ok)
    })
    this.lastLoadMessage = result.error
    if (result.error) print("[MEMAR] " + result.error)
    if (result.skipped > 0) print(`[MEMAR] skipped ${result.skipped} unreadable saved memories`)

    if (this.seedDemoData) {
      const now = Date.now()
      const total = this.store.getMemoryCounts().total
      const seeded = Number(this.storage.getValue(SEED_VERSION_KEY) ?? (total > 0 ? 1 : 0))
      if (total === 0) {
        for (const input of demoSeed(now)) this.store.createMemory(input)
      } else if (seeded < DEMO_SEED_VERSION) {
        // Existing user, newer catalog: add starters only on objects they've never used.
        for (const input of seedForNewObjects(this.store, now)) this.store.createMemory(input)
      }
      this.storage.setValue(SEED_VERSION_KEY, String(DEMO_SEED_VERSION))
    }
    print(`[MEMAR] ready: ${this.store.getMemoryCounts().total} memories, storage=${this.storage.kind}`)
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  selectObject(objectId: string, via: RecognitionType = "stand-in"): boolean {
    if (!findObject(objectId)) return false
    this.selectedObjectId = objectId
    for (const l of this.selectionListeners) l(objectId, via)
    return true
  }

  clearSelection(): void {
    this.selectedObjectId = undefined
    for (const l of this.selectionListeners) l(undefined, undefined)
  }

  onSelectionChanged(listener: SelectionListener): () => void {
    this.selectionListeners.push(listener)
    return () => {
      this.selectionListeners = this.selectionListeners.filter((l) => l !== listener)
    }
  }

  onSaved(listener: SaveListener): () => void {
    this.saveListeners.push(listener)
    return () => {
      this.saveListeners = this.saveListeners.filter((l) => l !== listener)
    }
  }

  /** For LEAF: put the app back to a known state between scenarios. */
  resetForTest(seed: boolean = true): void {
    this.store.clearAll()
    this.clearSelection()
    if (seed) for (const input of demoSeed(Date.now())) this.store.createMemory(input)
  }
}
