// MEMORA core tests. Run: npm test  (from the repo root; compiles TS then runs this with node:test)
// These cover the memory engine only. UI and scene behaviour are covered by LEAF in Lens Studio.
const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const build = path.join(__dirname, "..", ".test-build", "Assets", "Scripts", "Memora")
const {MemoraStore, DUPLICATE_WINDOW_MS, formatDue} = require(path.join(build, "MemoraStore.js"))
const {SessionStorageAdapter, PersistentStorageAdapter, bindStorage, STORAGE_KEY} = require(path.join(build, "MemoraStorage.js"))
const {demoSeed, QUICK_PRESETS, presetsFor, presetInput} = require(path.join(build, "MemoraSampleData.js"))
const {MEMORA_OBJECTS} = require(path.join(build, "MemoraObjects.js"))

global.print = () => {}
const H = 60 * 60 * 1000
const NOON = new Date(2026, 10, 9, 12, 0, 0).getTime() // 9 Nov 2026 12:00 local

function fakeClock(start = NOON) {
  let t = start
  const clock = () => t
  clock.advance = (ms) => (t += ms)
  return clock
}

test("definition of done: create Laptop memory, recall, complete, disappears from pending", () => {
  const store = new MemoraStore(fakeClock())
  const r = store.createMemory({title: "Submit the project report", objectId: "laptop", priority: "high"})
  assert.equal(r.ok, true)
  const pending = store.getPendingMemoriesByObject("laptop")
  assert.equal(pending.length, 1)
  assert.equal(pending[0].objectName, "Laptop")
  assert.equal(store.getMemoryById(r.value.id).title, "Submit the project report")
  store.completeMemory(r.value.id)
  assert.equal(store.getPendingMemoriesByObject("laptop").length, 0)
  assert.equal(store.getMemoryCounts().completed, 1)
})

test("empty or whitespace title is rejected with a message", () => {
  const store = new MemoraStore(fakeClock())
  for (const title of ["", "   "]) {
    const r = store.createMemory({title, objectId: "laptop"})
    assert.equal(r.ok, false)
    assert.match(r.error, /title/i)
  }
  assert.equal(store.getMemoryCounts().total, 0)
})

test("unknown object and overlong title are rejected", () => {
  const store = new MemoraStore(fakeClock())
  assert.equal(store.createMemory({title: "x", objectId: "spaceship"}).ok, false)
  assert.equal(store.createMemory({title: "x".repeat(81), objectId: "keys"}).ok, false)
})

test("object filter: Laptop memories never appear under Keys", () => {
  const store = new MemoraStore(fakeClock())
  store.createMemory({title: "Laptop thing", objectId: "laptop"})
  store.createMemory({title: "Keys thing", objectId: "keys"})
  assert.deepEqual(store.getPendingMemoriesByObject("keys").map((m) => m.title), ["Keys thing"])
  assert.deepEqual(store.getPendingMemoriesByObject("laptop").map((m) => m.title), ["Laptop thing"])
  assert.equal(store.getPendingMemoriesByObject("notebook").length, 0)
})

test("double pinch on Save does not create a duplicate, but a later identical save does", () => {
  const clock = fakeClock()
  const store = new MemoraStore(clock)
  const a = store.createMemory({title: "Pack the charger", objectId: "bag"})
  const b = store.createMemory({title: "pack the charger ", objectId: "bag"})
  assert.equal(a.value.id, b.value.id)
  clock.advance(DUPLICATE_WINDOW_MS + 1)
  store.createMemory({title: "Pack the charger", objectId: "bag"})
  assert.equal(store.pendingCountFor("bag"), 2)
})

test("complete is idempotent, undo restores pending and counts", () => {
  const store = new MemoraStore(fakeClock())
  const {value: m} = store.createMemory({title: "A", objectId: "notebook"})
  store.completeMemory(m.id)
  store.completeMemory(m.id)
  assert.equal(store.getMemoryCounts().completed, 1)
  assert.equal(store.lastCompletedId, m.id)
  const u = store.undoCompleteMemory()
  assert.equal(u.ok, true)
  assert.equal(store.getMemoryById(m.id).status, "pending")
  assert.equal(store.getMemoryCounts().pending, 1)
  assert.equal(store.undoCompleteMemory().ok, false) // nothing left to undo
})

test("edit updates fields, moves object, validates, clears due date", () => {
  const store = new MemoraStore(fakeClock())
  const {value: m} = store.createMemory({title: "Old", objectId: "laptop", dueAt: NOON + H})
  assert.equal(store.updateMemory(m.id, {title: " "}).ok, false)
  const r = store.updateMemory(m.id, {title: "New", objectId: "bag", priority: "low", dueAt: null})
  assert.equal(r.ok, true)
  assert.equal(r.value.objectName, "Bag")
  assert.equal(r.value.dueAt, undefined)
  assert.equal(store.getPendingMemoriesByObject("laptop").length, 0)
  assert.equal(store.updateMemory("nope", {title: "x"}).ok, false)
})

test("delete removes the memory and updates counts", () => {
  const store = new MemoraStore(fakeClock())
  const {value: m} = store.createMemory({title: "A", objectId: "keys"})
  assert.equal(store.deleteMemory(m.id), true)
  assert.equal(store.deleteMemory(m.id), false)
  assert.equal(store.getMemoryCounts().total, 0)
})

test("due states: overdue is not labelled due today; counts are right", () => {
  const store = new MemoraStore(fakeClock())
  const overdue = store.createMemory({title: "late", objectId: "laptop", dueAt: NOON - H}).value
  const today = store.createMemory({title: "today", objectId: "laptop", dueAt: NOON + 2 * H}).value
  const later = store.createMemory({title: "later", objectId: "laptop", dueAt: NOON + 48 * H}).value
  assert.equal(store.dueState(overdue), "overdue")
  assert.equal(store.dueState(today), "today")
  assert.equal(store.dueState(later), "upcoming")
  const c = store.getMemoryCounts()
  assert.equal(c.overdue, 1)
  assert.equal(c.dueToday, 1)
  assert.equal(formatDue(overdue, NOON), "Overdue")
  assert.equal(formatDue(today, NOON), "Today 2:00 PM")
})

test("ordering: overdue first, then priority, then due date", () => {
  const store = new MemoraStore(fakeClock())
  store.createMemory({title: "low", objectId: "laptop", priority: "low"})
  store.createMemory({title: "high-late", objectId: "laptop", priority: "high", dueAt: NOON + 5 * H})
  store.createMemory({title: "high-soon", objectId: "laptop", priority: "high", dueAt: NOON + 1 * H})
  store.createMemory({title: "overdue-low", objectId: "laptop", priority: "low", dueAt: NOON - H})
  assert.deepEqual(
    store.getPendingMemoriesByObject("laptop").map((m) => m.title),
    ["overdue-low", "high-soon", "high-late", "low"],
  )
})

test("serialization round trip keeps every field", () => {
  const store = new MemoraStore(fakeClock())
  store.createMemory({title: "A", description: "note", objectId: "laptop", priority: "high", dueAt: NOON + H, recognitionType: "stand-in"})
  const copy = new MemoraStore(fakeClock())
  const r = copy.loadJSON(store.toJSON())
  assert.equal(r.loaded, 1)
  const [m] = copy.getAllMemories()
  assert.equal(m.description, "note")
  assert.equal(m.recognitionType, "stand-in")
  assert.equal(m.dueAt, NOON + H)
})

test("corrupted or foreign data never crashes and bad records are skipped", () => {
  const store = new MemoraStore(fakeClock())
  assert.ok(store.loadJSON("{not json").error)
  assert.ok(store.loadJSON(JSON.stringify({hello: 1})).error)
  assert.ok(store.loadJSON(JSON.stringify({schemaVersion: 99, memories: []})).error)
  const mixed = JSON.stringify({
    schemaVersion: 1,
    memories: [
      {id: "ok", title: "Fine", objectId: "keys", createdAt: NOON, priority: "weird"},
      {id: "bad1", title: "", objectId: "keys", createdAt: NOON},
      {id: "bad2", title: "x", objectId: "spaceship", createdAt: NOON},
      null,
    ],
  })
  const r = store.loadJSON(mixed)
  assert.equal(r.loaded, 1)
  assert.equal(r.skipped, 3)
  assert.equal(store.getAllMemories()[0].priority, "medium")
  assert.equal(store.loadJSON(undefined).loaded, 0)
})

test("bindStorage: saves after each change and reloads into a new store (restart)", () => {
  const adapter = new SessionStorageAdapter()
  const a = new MemoraStore(fakeClock())
  const results = []
  bindStorage(a, adapter, (ok) => results.push(ok))
  a.createMemory({title: "Persist me", objectId: "notebook"})
  assert.deepEqual(results, [true])
  const b = new MemoraStore(fakeClock())
  bindStorage(b, adapter)
  assert.equal(b.getPendingMemoriesByObject("notebook")[0].title, "Persist me")
})

test("PersistentStorageAdapter talks to a GeneralDataStore and reports failures honestly", () => {
  const data = new Map()
  const fake = {
    putString: (k, v) => data.set(k, v),
    getString: (k) => data.get(k),
    has: (k) => data.has(k),
    remove: (k) => data.delete(k),
    onStoreFull: null,
  }
  const adapter = new PersistentStorageAdapter(fake)
  assert.equal(adapter.load(), undefined)
  assert.equal(adapter.save("{}"), true)
  assert.equal(data.get(STORAGE_KEY), "{}")
  fake.onStoreFull() // store reports full
  assert.equal(adapter.save("{}"), false)
  adapter.clear()
  assert.equal(data.has(STORAGE_KEY), false)

  const broken = {...fake, putString: () => { throw new Error("disk") }, onStoreFull: null}
  assert.equal(new PersistentStorageAdapter(broken).save("{}"), false)
})

test("demo seed and presets reference real objects and are valid", () => {
  const store = new MemoraStore(fakeClock())
  for (const input of demoSeed(NOON)) assert.equal(store.createMemory(input).ok, true)
  for (const o of MEMORA_OBJECTS) assert.ok(QUICK_PRESETS[o.id] && QUICK_PRESETS[o.id].length > 0, o.id)
  assert.equal(store.pendingCountFor("laptop"), 2)
})

test("demo seed stays 'due today' at any time of day; presets turn into valid inputs", () => {
  for (const [h, m] of [[9, 0], [16, 30], [21, 0], [23, 0], [23, 20]]) {
    const now = new Date(2026, 10, 9, h, m, 0).getTime()
    const store = new MemoraStore(fakeClock(now))
    for (const input of demoSeed(now)) assert.equal(store.createMemory(input).ok, true)
    const counts = store.getMemoryCounts()
    assert.equal(counts.pending, 8, `${h}:${m}`)
    assert.equal(counts.dueToday, 3, `${h}:${m} due today`)
    assert.equal(counts.overdue, 0, `${h}:${m} overdue`)
    assert.match(formatDue(store.getPendingMemoriesByObject("laptop")[0], now), /^Today /)
  }
  const now = NOON
  const store = new MemoraStore(fakeClock(now))
  for (const o of MEMORA_OBJECTS) {
    for (const p of presetsFor(o.id)) {
      const r = store.createMemory(presetInput(o.id, p, now))
      assert.equal(r.ok, true, p.title)
      assert.equal(r.value.recognitionType, "stand-in")
      assert.equal(r.value.dueAt, p.dueInHours === undefined ? undefined : now + p.dueInHours * H)
    }
  }
  assert.deepEqual(presetsFor("spaceship"), [])
})

test("change listeners fire and can unsubscribe", () => {
  const store = new MemoraStore(fakeClock())
  let n = 0
  const off = store.onChange(() => n++)
  store.createMemory({title: "A", objectId: "keys"})
  off()
  store.createMemory({title: "B", objectId: "keys"})
  assert.equal(n, 1)
})
