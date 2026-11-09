// Records a real, live run of the MEMAR web simulator (same engine as the Lens) at phone size.
// Frames come from the DevTools screencast of headless Edge, with their real timestamps, plus a
// mark for every scripted tap so the narration can be lined up with what happens on screen.
//
// Usage: node tools/video/record_sim.js <web-sim/index.html> <out dir>
// Needs: Microsoft Edge and playwright-core (npm i --no-save playwright-core@1.47.2, or NODE_PATH).
const {chromium} = require("playwright-core")
const fs = require("fs")
const path = require("path")

const pageUrl = "file:///" + path.resolve(process.argv[2]).split(path.sep).join("/")
const outDir = path.resolve(process.argv[3])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const dir = path.join(outDir, "frames")
  fs.rmSync(dir, {recursive: true, force: true})
  fs.mkdirSync(dir, {recursive: true})
  const browser = await chromium.launch({channel: "msedge", headless: true})
  const context = await browser.newContext({viewport: {width: 430, height: 932}, deviceScaleFactor: 2, isMobile: true, hasTouch: true})
  const page = await context.newPage()
  // A visible touch ripple wherever we tap, so viewers can follow the taps.
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const st = document.createElement("style")
      st.textContent = `.tap-dot{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
        background:rgba(92,225,255,.35);border:3px solid rgba(92,225,255,.95);pointer-events:none;z-index:9999;
        animation:tapdot .6s ease-out forwards}@keyframes tapdot{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}`
      document.head.appendChild(st)
      document.addEventListener("pointerdown", (e) => {
        const d = document.createElement("div")
        d.className = "tap-dot"
        d.style.left = e.clientX + "px"
        d.style.top = e.clientY + "px"
        document.body.appendChild(d)
        setTimeout(() => d.remove(), 750)
      }, true)
    })
  })
  const cdp = await context.newCDPSession(page)
  const frames = []
  const marks = []
  cdp.on("Page.screencastFrame", async ({data, metadata, sessionId}) => {
    const f = path.join(dir, String(frames.length).padStart(5, "0") + ".jpg")
    fs.writeFileSync(f, Buffer.from(data, "base64"))
    frames.push({f, t: metadata.timestamp})
    try { await cdp.send("Page.screencastFrameAck", {sessionId}) } catch (e) {}
  })
  await page.goto(pageUrl)
  await cdp.send("Page.startScreencast", {format: "jpeg", quality: 95, maxWidth: 860, maxHeight: 1864, everyNthFrame: 1})
  await sleep(1600)

  const mark = (label) => marks.push({label, t: Date.now() / 1000})
  const tap = async (selector, wait = 1300, label = selector) => {
    const el = page.locator(selector).first()
    await el.scrollIntoViewIfNeeded()
    await sleep(250)
    mark(label)
    await el.tap()
    await sleep(wait)
  }
  const scrollTo = async (selector, label) => {
    mark(label)
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({behavior: "smooth", block: "center"}), selector)
    await sleep(1100)
  }

  // 1) Laptop: open, Done, Undo.
  await tap("#obj-laptop", 1700, "laptop")
  await tap('#sheet [data-act="done"]', 1900, "done")
  await tap("#UndoButton", 1500, "undo")
  await tap('#sheet [data-act="close"]', 700, "close1")
  // 2) Notebook: add from a preset.
  await tap("#obj-notebook", 1200, "notebook")
  await tap("#AddButton", 1200, "add")
  await tap('#sheet [data-act="preset"]', 1700, "preset")
  // 3) Say it (typed through the same voice path).
  await tap("#AddButton", 900, "add2")
  await tap('#sheet [data-act="voice"]', 900, "voice")
  mark("type")
  await page.locator("#typed").type("remind me to print the lab report", {delay: 45})
  await sleep(400)
  await tap('#sheet [data-act="typed"]', 1700, "preview")
  await tap("#SaveVoiceButton", 1700, "save")
  await tap('#sheet [data-act="close"]', 700, "close2")
  // 4) Kitchen: the daily routine comes back tomorrow.
  await scrollTo("#obj-medicine", "scroll-kitchen")
  await tap("#obj-medicine", 1500, "medicine")
  await tap('#sheet [data-act="done"]', 2300, "routine-done")
  await tap('#sheet [data-act="close"]', 700, "close3")
  // 5) Before you leave + Done list.
  await scrollTo(".leave", "scroll-leave")
  await sleep(900)
  await tap("#btnDone", 2200, "donelist")
  await tap('#sheet [data-act="close"]', 800, "close4")
  mark("scroll-top")
  await page.evaluate(() => window.scrollTo({top: 0, behavior: "smooth"}))
  await sleep(1400)
  const tEnd = Date.now() / 1000

  await cdp.send("Page.stopScreencast")
  await context.close()
  await browser.close()
  const t0 = frames[0].t
  const rel = (t) => +(t - t0).toFixed(4)
  const out = {
    width: 430, height: 932,
    frames: frames.map((x) => ({f: x.f.split(path.sep).join("/"), t: rel(x.t)})),
    marks: marks.map((m) => ({label: m.label, t: rel(m.t)})),
    end: rel(tEnd),
  }
  fs.writeFileSync(path.join(outDir, "frames.json"), JSON.stringify(out, null, 1))
  console.log(`frames ${frames.length}, ${out.end.toFixed(1)} s, marks:`, out.marks.map((m) => `${m.label}@${m.t.toFixed(1)}`).join(" "))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
