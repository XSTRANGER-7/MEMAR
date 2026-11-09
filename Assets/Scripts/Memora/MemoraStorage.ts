// MEMAR — storage adapters.
// PersistentStorageAdapter uses Lens Studio's documented persistent storage
// (global.persistentStorageSystem.store, a GeneralDataStore with putString/getString).
// Lens Studio Preview does NOT keep data between preview sessions, so memories only
// survive a restart on real glasses. That's why every done criterion is session-based,
// and the brief labels persistence "feel unproven".
// SessionStorageAdapter is the fallback when the persistent store is unavailable.

import {MemoraStore} from "./MemoraStore"

export const STORAGE_KEY = "memora.memories.v1"
/** Which demo seed this device has already received (so new objects get starters once). */
export const SEED_VERSION_KEY = "memora.seedVersion"

export interface StorageAdapter {
  readonly kind: "persistent" | "session"
  load(): string | undefined
  /** Returns false if the write failed, so the UI never claims a save that didn't happen. */
  save(json: string): boolean
  /** Small extra values (e.g. the seed version). */
  getValue(key: string): string | undefined
  setValue(key: string, value: string): boolean
  /** Removes the memories and the seed version. */
  clear(): void
}

export class SessionStorageAdapter implements StorageAdapter {
  readonly kind = "session" as const
  private value: string | undefined
  private values: Record<string, string> = {}
  load(): string | undefined {
    return this.value
  }
  save(json: string): boolean {
    this.value = json
    return true
  }
  getValue(key: string): string | undefined {
    return this.values[key]
  }
  setValue(key: string, value: string): boolean {
    this.values[key] = value
    return true
  }
  clear(): void {
    this.value = undefined
    this.values = {}
  }
}

export class PersistentStorageAdapter implements StorageAdapter {
  readonly kind = "persistent" as const
  private full = false

  constructor(private readonly store: GeneralDataStore) {
    try {
      this.store.onStoreFull = () => {
        this.full = true
        print("[MEMAR] persistent store is full; latest changes were not saved")
      }
    } catch (e) {
      // onStoreFull isn't available on every runtime; saving still works without it.
    }
  }

  load(): string | undefined {
    try {
      return this.store.has(STORAGE_KEY) ? this.store.getString(STORAGE_KEY) : undefined
    } catch (e) {
      print("[MEMAR] could not read storage: " + e)
      return undefined
    }
  }

  save(json: string): boolean {
    if (this.full) return false
    try {
      this.store.putString(STORAGE_KEY, json)
      return !this.full
    } catch (e) {
      print("[MEMAR] could not write storage: " + e)
      return false
    }
  }

  getValue(key: string): string | undefined {
    try {
      return this.store.has(key) ? this.store.getString(key) : undefined
    } catch (e) {
      return undefined
    }
  }

  setValue(key: string, value: string): boolean {
    if (this.full) return false
    try {
      this.store.putString(key, value)
      return !this.full
    } catch (e) {
      return false
    }
  }

  clear(): void {
    try {
      this.store.remove(STORAGE_KEY)
      this.store.remove(SEED_VERSION_KEY)
      this.full = false
    } catch (e) {
      print("[MEMAR] could not clear storage: " + e)
    }
  }
}

/** Picks the persistent store when the runtime has one, otherwise session memory. */
export function createStorageAdapter(): StorageAdapter {
  try {
    const store = global.persistentStorageSystem && global.persistentStorageSystem.store
    if (store) return new PersistentStorageAdapter(store)
  } catch (e) {
    // fall through
  }
  print("[MEMAR] persistent storage unavailable; using session-only storage")
  return new SessionStorageAdapter()
}

/**
 * Wire a store to an adapter: load once, then save after every change.
 * onSaveResult lets the UI show "Saved" or "Couldn't save" honestly.
 */
export function bindStorage(
  store: MemoraStore,
  adapter: StorageAdapter,
  onSaveResult?: (ok: boolean) => void,
): {loaded: number; skipped: number; error?: string} {
  const result = store.loadJSON(adapter.load())
  store.onChange(() => {
    const ok = adapter.save(store.toJSON())
    if (onSaveResult) onSaveResult(ok)
  })
  return result
}
