// MEMORA feature tests: zones and the object catalog, the Done archive, voice capture cleanup.
const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const build = path.join(__dirname, "..", ".test-build", "Assets", "Scripts", "Memora")
const {MemoraStore, TITLE_MAX} = require(path.join(build, "MemoraStore.js"))
const {demoSeed, DEMO_SEED_COUNTS, presetsFor} = require(path.join(build, "MemoraSampleData.js"))
const {MEMORA_OBJECTS, MEMORA_ZONES, findZone, objectsInZone, objectPositionFromDeskCm} = require(path.join(build, "MemoraObjects.js"))
const {cleanTranscript, priorityFromSpeech, speechInput} = require(path.join(build, "MemoraVoice.js"))

global.print = () => {}
const NOON = new Date(2026, 10, 9, 12, 0, 0).getTime()
function fakeClock(start = NOON) {
  let t = start
  const clock = () => t
  clock.advance = (ms) => (t += ms)
  return clock
}

test("catalog: every object has a real zone, a unique id, presets and a sensible size", () => {
  const ids = new Set()
  for (const o of MEMORA_OBJECTS) {
    assert.ok(findZone(o.zone), `${o.id} zone`)
    assert.ok(!ids.has(o.id), `${o.id} unique`)
    ids.add(o.id)
    assert.ok(presetsFor(o.id).length >= 2, `${o.id} presets`)
    assert.ok(o.sizeCm.w > 0 && o.sizeCm.d > 0 && o.sizeCm.h > 0, `${o.id} size`)
  }
  for (const z of MEMORA_ZONES) assert.ok(objectsInZone(z.id).length >= 3, `${z.id} has objects`)
  // Small and big things both exist.
  assert.ok(MEMORA_OBJECTS.some((o) => o.scale === "small"))
  assert.ok(MEMORA_OBJECTS.some((o) => o.scale === "large"))
})

test("layout: desk in front, entryway to the left, kitchen to the right, all facing the user", () => {
  const user = {x: 0, z: 85} // user start, relative to the desk centre (desk is 85 cm ahead)
  for (const o of objectsInZone("desk")) assert.deepEqual(objectPositionFromDeskCm(o.id), o.offsetCm)
  for (const o of objectsInZone("entryway")) assert.ok(objectPositionFromDeskCm(o.id).x < -60, o.id)
  for (const o of objectsInZone("kitchen")) assert.ok(objectPositionFromDeskCm(o.id).x > 60, o.id)
  for (const z of MEMORA_ZONES) {
    const yaw = (z.yawDeg * Math.PI) / 180
    const front = {x: Math.sin(yaw), z: Math.cos(yaw)}
    const toUser = {x: user.x - z.anchorFromDeskCm.x, z: user.z - z.anchorFromDeskCm.z}
    const l = Math.hypot(toUser.x, toUser.z)
    const angle = (Math.acos((front.x * toUser.x + front.z * toUser.z) / l) * 180) / Math.PI
    assert.ok(angle < 15, `${z.id} faces the user (off by ${angle.toFixed(1)} deg)`)
    // Every zone sits within a comfortable 0.6–2.5 m of the user.
    assert.ok(l >= 60 && l <= 250, `${z.id} distance ${l.toFixed(0)} cm`)
  }
  assert.equal(objectPositionFromDeskCm("other"), undefined)
  assert.equal(objectPositionFromDeskCm("spaceship"), undefined)
})

test("demo seed: per-object counts match DEMO_SEED_COUNTS and the brief's desk moment", () => {
  const store = new MemoraStore(fakeClock())
  for (const input of demoSeed(NOON)) assert.equal(store.createMemory(input).ok, true)
  for (const o of MEMORA_OBJECTS) assert.equal(store.pendingCountFor(o.id), DEMO_SEED_COUNTS[o.id] ?? 0, o.id)
  assert.equal(store.pendingCountFor("laptop"), 2)
  assert.equal(store.pendingCountFor("keys"), 1)
  assert.equal(store.pendingCountFor("bag"), 1)
  assert.equal(store.pendingCountFor("notebook"), 0)
  assert.equal(store.pendingCountForZone("desk"), 4)
  assert.equal(store.pendingCountForZone("entryway"), 2)
  assert.equal(store.pendingCountForZone("kitchen"), 2)
  assert.equal(store.pendingCountForZone("nowhere"), 0)
  assert.equal(store.getPendingMemoriesByObject("laptop")[0].title, "Submit the project report")
})

test("zone counts follow complete, undo and delete", () => {
  const store = new MemoraStore(fakeClock())
  for (const input of demoSeed(NOON)) store.createMemory(input)
  const milk = store.getPendingMemoriesByObject("fridge")[0]
  store.completeMemory(milk.id)
  assert.equal(store.pendingCountForZone("kitchen"), 1)
  store.undoCompleteMemory()
  assert.equal(store.pendingCountForZone("kitchen"), 2)
  store.deleteMemory(milk.id)
  assert.equal(store.pendingCountForZone("kitchen"), 1)
})

test("Done archive: most recent first, limit, restore, clear done", () => {
  const clock = fakeClock()
  const store = new MemoraStore(clock)
  const a = store.createMemory({title: "A", objectId: "keys"}).value
  const b = store.createMemory({title: "B", objectId: "laptop"}).value
  const c = store.createMemory({title: "C", objectId: "fridge"}).value
  store.completeMemory(a.id)
  clock.advance(1000)
  store.completeMemory(c.id)
  clock.advance(1000)
  store.completeMemory(b.id)
  assert.deepEqual(store.getCompletedMemories().map((m) => m.title), ["B", "C", "A"])
  assert.deepEqual(store.getCompletedMemories(2).map((m) => m.title), ["B", "C"])
  assert.deepEqual(store.getCompletedMemories(0), [])

  assert.equal(store.restoreMemory(c.id).ok, true)
  assert.equal(store.getMemoryById(c.id).status, "pending")
  assert.equal(store.getMemoryById(c.id).completedAt, undefined)
  assert.equal(store.restoreMemory("missing").ok, false)

  let changes = 0
  store.onChange(() => changes++)
  assert.equal(store.clearCompleted(), 2)
  assert.equal(changes, 1)
  assert.deepEqual(store.getAllMemories().map((m) => m.title), ["C"])
  assert.equal(store.clearCompleted(), 0)
  assert.equal(changes, 1, "no change event when nothing was cleared")
})

test("voice: transcripts are cleaned into short titles", () => {
  assert.equal(cleanTranscript("  um, remind me to   call home.  "), "Call home")
  assert.equal(cleanTranscript("Don't forget to pay the electricity bill!"), "Pay the electricity bill")
  assert.equal(cleanTranscript("okay so buy eggs"), "Buy eggs")
  assert.equal(cleanTranscript("Sort the files"), "Sort the files", "words starting with a filler stay")
  assert.equal(cleanTranscript("   "), "")
  assert.equal(cleanTranscript("uh"), "")
  assert.equal(cleanTranscript(undefined), "")
  const long = cleanTranscript("remind me to " + "carry the blue folder with the signed forms ".repeat(4))
  assert.ok(long.length <= TITLE_MAX, `length ${long.length}`)
  assert.ok(long.endsWith("…"))
  assert.ok(!/\s…$/.test(long), "cut at a word boundary, no dangling space")
})

test("voice: priority from words, and a spoken memory saves on the pinched object", () => {
  assert.equal(priorityFromSpeech("this is urgent, call the bank"), "high")
  assert.equal(priorityFromSpeech("water the plant"), "medium")
  assert.equal(speechInput("door", "  um "), undefined)
  const input = speechInput("door", "remind me to lock the back door, it's important")
  assert.deepEqual(input, {title: "Lock the back door, it's important", objectId: "door", priority: "high", recognitionType: "stand-in"})
  const store = new MemoraStore(fakeClock())
  const r = store.createMemory(input)
  assert.equal(r.ok, true)
  assert.equal(r.value.objectName, "Front door")
  assert.equal(store.pendingCountFor("door"), 1)
})

test("seed top-up: an existing user gets starters only on objects they've never used", () => {
  const {seedForNewObjects, DEMO_SEED_VERSION} = require(path.join(build, "MemoraSampleData.js"))
  assert.ok(DEMO_SEED_VERSION >= 2)
  const store = new MemoraStore(fakeClock())
  // A v1 user: desk memories only, one completed, one deleted.
  const report = store.createMemory({title: "Submit the project report", objectId: "laptop", priority: "high"}).value
  store.createMemory({title: "Collect the parcel before leaving", objectId: "keys"})
  store.completeMemory(report.id)
  const charger = store.createMemory({title: "Pack the charger", objectId: "bag"}).value
  store.deleteMemory(charger.id)
  const topUp = seedForNewObjects(store, NOON)
  const ids = topUp.map((i) => i.objectId).sort()
  // The bag has no memories left, so it gets its starter back; laptop and keys never do.
  assert.deepEqual(ids, ["bag", "fridge", "medicine", "umbrella", "wallet"])
  for (const input of topUp) assert.equal(store.createMemory(input).ok, true)
  assert.equal(store.pendingCountForZone("kitchen"), 2)
  assert.equal(seedForNewObjects(store, NOON).length, 0, "nothing left to top up")
})

test("storage adapters keep small values and clear them with the memories", () => {
  const {SessionStorageAdapter, PersistentStorageAdapter, SEED_VERSION_KEY, STORAGE_KEY} = require(path.join(build, "MemoraStorage.js"))
  const session = new SessionStorageAdapter()
  assert.equal(session.getValue(SEED_VERSION_KEY), undefined)
  assert.equal(session.setValue(SEED_VERSION_KEY, "2"), true)
  assert.equal(session.getValue(SEED_VERSION_KEY), "2")
  session.clear()
  assert.equal(session.getValue(SEED_VERSION_KEY), undefined)

  const data = new Map()
  const fake = {putString: (k, v) => data.set(k, v), getString: (k) => data.get(k), has: (k) => data.has(k), remove: (k) => data.delete(k), onStoreFull: null}
  const persistent = new PersistentStorageAdapter(fake)
  persistent.save("{}")
  assert.equal(persistent.setValue(SEED_VERSION_KEY, "2"), true)
  assert.equal(persistent.getValue(SEED_VERSION_KEY), "2")
  persistent.clear()
  assert.equal(data.has(STORAGE_KEY), false)
  assert.equal(data.has(SEED_VERSION_KEY), false)
  const broken = {...fake, putString: () => { throw new Error("disk") }, onStoreFull: null}
  assert.equal(new PersistentStorageAdapter(broken).setValue("k", "v"), false)
})
