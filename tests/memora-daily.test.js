// MEMORA daily-life tests: routine (repeating) memories, snooze, and the "Before you leave" check.
const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const build = path.join(__dirname, "..", ".test-build", "Assets", "Scripts", "Memora")
const {MemoraStore, nextOccurrence, formatRepeat, formatDue} = require(path.join(build, "MemoraStore.js"))
const {demoSeed, presetsFor, presetInput} = require(path.join(build, "MemoraSampleData.js"))
const {MEMORA_OBJECTS} = require(path.join(build, "MemoraObjects.js"))

global.print = () => {}
const MIN = 60 * 1000
const H = 60 * MIN
const DAY = 24 * H
const NOON = new Date(2026, 10, 9, 12, 0, 0).getTime()
function fakeClock(start = NOON) {
  let t = start
  const clock = () => t
  clock.advance = (ms) => (t += ms)
  return clock
}

test("routine: Done on a daily memory schedules tomorrow at the same time", () => {
  const clock = fakeClock()
  const store = new MemoraStore(clock)
  const due = NOON + 2 * H // 2 PM today
  const m = store.createMemory({title: "Take vitamin D after lunch", objectId: "medicine", priority: "high", dueAt: due, repeat: "daily"}).value
  assert.equal(formatRepeat(m), "Daily")
  clock.advance(3 * H) // done late, at 3 PM
  assert.equal(store.completeMemory(m.id).ok, true)
  const pending = store.getPendingMemoriesByObject("medicine")
  assert.equal(pending.length, 1)
  assert.notEqual(pending[0].id, m.id)
  assert.equal(pending[0].dueAt, due + DAY, "same time tomorrow")
  assert.equal(pending[0].repeat, "daily")
  assert.equal(pending[0].priority, "high")
  assert.match(formatDue(pending[0], clock()), /^Tomorrow 2:00 PM$/)
  assert.equal(store.getNextOccurrence(m.id).id, pending[0].id)
  // Badge count stays 1 and nothing is due today any more.
  assert.equal(store.pendingCountFor("medicine"), 1)
  assert.equal(store.getMemoryCounts().dueToday, 0)
  // Completing twice does not schedule twice.
  store.completeMemory(m.id)
  assert.equal(store.getPendingMemoriesByObject("medicine").length, 1)
})

test("routine: Undo and Restore remove the scheduled next occurrence (no duplicates)", () => {
  const store = new MemoraStore(fakeClock())
  const m = store.createMemory({title: "Refill the water bottle", objectId: "bottle", repeat: "daily"}).value
  store.completeMemory(m.id)
  assert.equal(store.pendingCountFor("bottle"), 1)
  store.undoCompleteMemory()
  assert.equal(store.pendingCountFor("bottle"), 1)
  assert.equal(store.getPendingMemoriesByObject("bottle")[0].id, m.id)
  assert.equal(store.getMemoryById(m.id).nextId, undefined)
  // Restore from the Done list later behaves the same.
  store.completeMemory(m.id)
  assert.equal(store.restoreMemory(m.id).ok, true)
  assert.deepEqual(store.getPendingMemoriesByObject("bottle").map((x) => x.id), [m.id])
})

test("routine: weekly rolls forward past now; one-off memories never repeat", () => {
  assert.equal(nextOccurrence(NOON, "weekly", NOON), NOON + 7 * DAY)
  // Due long ago: the next one is the first slot after now, keeping the time of day.
  const old = NOON - 10 * DAY + 2 * H
  const next = nextOccurrence(old, "daily", NOON)
  assert.ok(next > NOON && next <= NOON + DAY)
  assert.equal(new Date(next).getHours(), 14)
  assert.equal(nextOccurrence(NOON, "none", NOON), NOON)
  const store = new MemoraStore(fakeClock())
  const once = store.createMemory({title: "One-off", objectId: "keys"}).value
  assert.equal(once.repeat, undefined)
  store.completeMemory(once.id)
  assert.equal(store.pendingCountFor("keys"), 0)
  assert.equal(store.createMemory({title: "Bad", objectId: "keys", repeat: "hourly"}).ok, false)
  // "none" is stored as a one-off.
  assert.equal(store.createMemory({title: "None", objectId: "keys", repeat: "none"}).value.repeat, undefined)
})

test("routine: repeat can be changed in details and survives save/load", () => {
  const store = new MemoraStore(fakeClock())
  const m = store.createMemory({title: "Water the plant", objectId: "bottle"}).value
  assert.equal(store.updateMemory(m.id, {repeat: "weekly"}).value.repeat, "weekly")
  assert.equal(store.updateMemory(m.id, {repeat: "none"}).value.repeat, undefined)
  store.updateMemory(m.id, {repeat: "daily"})
  store.completeMemory(m.id)
  const copy = new MemoraStore(fakeClock())
  copy.loadJSON(store.toJSON())
  assert.equal(copy.getMemoryById(m.id).repeat, "daily")
  assert.equal(copy.getMemoryById(m.id).nextId, store.getMemoryById(m.id).nextId)
  assert.equal(copy.getPendingMemoriesByObject("bottle")[0].repeat, "daily")
})

test("snooze: pushes the due time an hour past now (or past a later due time)", () => {
  const clock = fakeClock()
  const store = new MemoraStore(clock)
  const a = store.createMemory({title: "No due", objectId: "laptop"}).value
  assert.equal(store.snoozeMemory(a.id).value.dueAt, NOON + H)
  const b = store.createMemory({title: "Overdue", objectId: "laptop", dueAt: NOON - 2 * H}).value
  assert.equal(store.dueState(b), "overdue")
  store.snoozeMemory(b.id, 30)
  assert.equal(b.dueAt, NOON + 30 * MIN)
  assert.equal(store.dueState(b), "today", "a snoozed overdue memory is no longer overdue")
  const c = store.createMemory({title: "Later today", objectId: "laptop", dueAt: NOON + 5 * H}).value
  store.snoozeMemory(c.id)
  assert.equal(c.dueAt, NOON + 6 * H)
  store.completeMemory(c.id)
  assert.equal(store.snoozeMemory(c.id).ok, false, "completed memories can't be snoozed")
  assert.equal(store.snoozeMemory("missing").ok, false)
  assert.equal(store.snoozeMemory(a.id, 0).ok, false)
})

test("leave-home check: lists carry-along things with pending memories, then 'all set'", () => {
  const store = new MemoraStore(fakeClock())
  for (const input of demoSeed(NOON)) store.createMemory(input)
  const carry = MEMORA_OBJECTS.filter((o) => o.carry).map((o) => o.id)
  assert.deepEqual(carry, ["keys", "bag", "wallet", "umbrella", "bottle"])
  const list = store.leaveHomeChecklist()
  assert.deepEqual(list.map((i) => i.objectId), ["keys", "bag", "wallet", "umbrella"])
  assert.equal(list[0].firstTitle, "Collect the parcel before leaving")
  assert.equal(list[0].objectName, "Keys")
  // Laptop, fridge and medicine never appear: you don't carry them.
  assert.ok(!list.some((i) => ["laptop", "fridge", "medicine", "door"].indexOf(i.objectId) >= 0))
  for (const id of carry) for (const m of store.getPendingMemoriesByObject(id)) store.completeMemory(m.id)
  assert.deepEqual(store.leaveHomeChecklist(), [])
})

test("presets and seed carry their routine flag", () => {
  const vitamin = presetsFor("medicine").filter((p) => p.title === "Take vitamin D after lunch")[0]
  assert.equal(presetInput("medicine", vitamin, NOON).repeat, "daily")
  const seeded = demoSeed(NOON).filter((i) => i.objectId === "medicine")[0]
  assert.equal(seeded.repeat, "daily")
  assert.equal(presetInput("laptop", presetsFor("laptop")[0], NOON).repeat, undefined)
})
