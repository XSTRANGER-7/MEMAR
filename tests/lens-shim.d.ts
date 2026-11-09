// Minimal stand-ins for the Lens Studio globals used by MemoraStorage, so the core
// compiles under plain tsc for Node tests. Lens Studio provides the real ones.
declare function print(msg: unknown): void
interface GeneralDataStore {
  putString(key: string, value: string): void
  getString(key: string): string
  has(key: string): boolean
  remove(key: string): void
  onStoreFull: () => void
}
declare const global: {persistentStorageSystem?: {store: GeneralDataStore}}
