// MEMORA look-to-recall detector tests. Run with the rest: npm test
const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("path")
const build = path.join(__dirname, "..", ".test-build", "Assets", "Scripts", "Memora")
const {MemoraDetector, gazeHits, targetsInView, DEFAULT_DETECTOR_CONFIG} = require(path.join(build, "MemoraDetector.js"))

const EYE = {x: 0, y: 0, z: 0}
const AHEAD = {x: 0, y: 0, z: -1} // camera looks down -Z
const LAPTOP = {id: "laptop", center: {x: 0, y: -25, z: -80}, radiusCm: 16}
const KEYS = {id: "keys", center: {x: -38, y: -30, z: -74}, radiusCm: 4}
const FRIDGE = {id: "fridge", center: {x: 200, y: -10, z: 0}, radiusCm: 45}
const towards = (t) => ({x: t.center.x - EYE.x, y: t.center.y - EYE.y, z: t.center.z - EYE.z})

function make() {
  const det = new MemoraDetector()
  det.setTargets([LAPTOP, KEYS, FRIDGE])
  return det
}

function run(det, forward, seconds, dt = 1 / 30) {
  let s
  for (let t = 0; t < seconds - 1e-9; t += dt) s = det.update(EYE, forward, dt)
  return s
}

test("gaze straight at an object hits it; looking away misses", () => {
  const hits = gazeHits(EYE, towards(LAPTOP), [LAPTOP, KEYS, FRIDGE])
  assert.equal(hits[0].id, "laptop")
  assert.ok(hits[0].aim > 0.95)
  assert.deepEqual(gazeHits(EYE, {x: 0, y: 1, z: 0}, [LAPTOP, KEYS, FRIDGE]), [])
})

test("big objects are easier to aim at than small ones (angular size counts)", () => {
  // 10 degrees off-centre: inside the fridge's angular size, outside the keys'.
  const off = (t, deg) => {
    const v = towards(t)
    const a = (deg * Math.PI) / 180
    return {x: v.x * Math.cos(a) - v.z * Math.sin(a), y: v.y, z: v.x * Math.sin(a) + v.z * Math.cos(a)}
  }
  assert.equal(gazeHits(EYE, off(FRIDGE, 10), [FRIDGE]).length, 1)
  assert.equal(gazeHits(EYE, off(KEYS, 10), [KEYS]).length, 0)
})

test("too far or too close is ignored; zero forward is safe", () => {
  const far = {id: "far", center: {x: 0, y: 0, z: -900}, radiusCm: 50}
  const near = {id: "near", center: {x: 0, y: 0, z: -5}, radiusCm: 2}
  assert.deepEqual(gazeHits(EYE, AHEAD, [far, near]), [])
  assert.deepEqual(gazeHits(EYE, {x: 0, y: 0, z: 0}, [LAPTOP]), [])
  assert.deepEqual(targetsInView(EYE, {x: 0, y: 0, z: 0}, [LAPTOP], 20), [])
})

test("dwell locks once after the dwell time, not before", () => {
  const det = make()
  const locks = []
  det.onLocked((id) => locks.push(id))
  let s = run(det, towards(LAPTOP), DEFAULT_DETECTOR_CONFIG.dwellSeconds * 0.5)
  assert.equal(s.phase, "tracking")
  assert.equal(s.targetId, "laptop")
  assert.ok(s.progress > 0.3 && s.progress < 0.7)
  assert.deepEqual(locks, [])
  s = run(det, towards(LAPTOP), DEFAULT_DETECTOR_CONFIG.dwellSeconds)
  assert.equal(s.phase, "locked")
  assert.equal(s.progress, 1)
  run(det, towards(LAPTOP), 2) // keep staring
  assert.deepEqual(locks, ["laptop"], "locks once per gaze episode")
})

test("switching objects restarts the dwell; looking away and back can lock again", () => {
  const det = make()
  const locks = []
  det.onLocked((id) => locks.push(id))
  run(det, towards(LAPTOP), 0.5)
  let s = run(det, towards(KEYS), 0.1)
  assert.equal(s.targetId, "keys")
  assert.ok(s.progress < 0.2)
  run(det, towards(KEYS), 1.2)
  assert.deepEqual(locks, ["keys"])
  run(det, {x: 0, y: 1, z: 0}, 1) // look at the ceiling
  assert.equal(det.getState().phase, "idle")
  run(det, towards(KEYS), 1.2)
  assert.deepEqual(locks, ["keys", "keys"])
})

test("a brief slip inside the grace window keeps progress", () => {
  const det = make()
  run(det, towards(LAPTOP), 0.5)
  const before = det.getState().progress
  det.update(EYE, {x: 0, y: 1, z: 0}, 0.1) // 0.1 s glance away, under the 0.25 s grace
  assert.equal(det.getState().targetId, "laptop")
  assert.equal(det.getState().progress, before)
})

test("disabled detector never locks; removing the tracked target resets", () => {
  const det = new MemoraDetector()
  const locks = []
  det.onLocked((id) => locks.push(id))
  det.setTargets([LAPTOP])
  det.setEnabled(false)
  run(det, towards(LAPTOP), 2)
  assert.deepEqual(locks, [])
  det.setEnabled(true)
  run(det, towards(LAPTOP), 0.3)
  assert.equal(det.getState().targetId, "laptop")
  det.setTargets([KEYS])
  assert.equal(det.getState().phase, "idle")
})

test("scan area lists everything in the view cone, centre first", () => {
  const ids = targetsInView(EYE, AHEAD, [LAPTOP, KEYS, FRIDGE], 35)
  assert.deepEqual(ids, ["laptop", "keys"])
})
