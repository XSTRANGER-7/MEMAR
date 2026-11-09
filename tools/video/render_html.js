// Renders one animated HTML scene to numbered JPEG frames, deterministically: for every frame the
// page's window.setTime(t) lays the scene out at time t, then we take a screenshot.
//
// Usage: node tools/video/render_html.js <scene.html> <params.json> <frames dir>
// params.json: { dur, fps, ...scene params } (the page reads them as window.PARAMS)
const {chromium} = require("playwright-core")
const fs = require("fs")
const path = require("path")

const html = path.resolve(process.argv[2])
const params = JSON.parse(fs.readFileSync(process.argv[3], "utf8"))
const outDir = path.resolve(process.argv[4])

;(async () => {
  fs.rmSync(outDir, {recursive: true, force: true})
  fs.mkdirSync(outDir, {recursive: true})
  const browser = await chromium.launch({channel: "msedge", headless: true})
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1})
  await page.addInitScript((p) => { window.PARAMS = p }, params)
  await page.goto("file:///" + html.split(path.sep).join("/"))
  await page.waitForFunction(() => window.READY === true, null, {timeout: 30000})
  const fps = params.fps || 30
  const n = Math.round(params.dur * fps)
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.setTime(t), i / fps)
    await page.screenshot({path: path.join(outDir, String(i).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 92})
  }
  await browser.close()
  console.log(`rendered ${n} frames`)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
