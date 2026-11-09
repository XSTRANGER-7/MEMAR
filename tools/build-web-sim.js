// MEMAR web simulator build: compiles the real engine (Assets/Scripts/Memora, the same files
// the SPECS Lens runs and `npm test` checks) and bundles it into one HTML page you can open in
// any browser, including a phone. Run: npm run sim
//
// Output:
//   web-sim/index.html       full page (open locally, or serve over Wi-Fi to your phone)
//   web-sim/memora-sim.html  same page body, for publishing as a hosted page
//
// The engine is not rewritten or copied by hand: tsc compiles it to CommonJS, and this script
// wraps each module in a tiny require() so the browser can load them from one file.

const fs = require("fs")
const path = require("path")
const {execSync} = require("child_process")

const root = path.join(__dirname, "..")
const buildDir = path.join(root, ".test-build", "Assets", "Scripts", "Memora")
const modules = ["MemoraTypes", "MemoraObjects", "MemoraSampleData", "MemoraStore", "MemoraStorage", "MemoraVoice", "MemoraDetector"]

console.log("Compiling the engine with tsc…")
execSync("npx -y -p typescript@5.6.3 tsc -p tests/tsconfig.test.json", {cwd: root, stdio: "inherit"})

const parts = modules.map((name) => {
  const src = fs.readFileSync(path.join(buildDir, `${name}.js`), "utf8")
  return `"./${name}": function (exports, require, module) {\n${src}\n}`
})

const bundle = `/* MEMAR engine, compiled from Assets/Scripts/Memora (do not edit; run npm run sim) */
(function () {
  // Lens Studio globals the engine may mention; harmless stand-ins in a browser.
  var print = function (m) { console.log(m) }
  var global = {}
  var defs = {${parts.join(",\n")}}
  var cache = {}
  function req(name) {
    var key = name.replace(/\\.js$/, "")
    if (cache[key]) return cache[key].exports
    if (!defs[key]) throw new Error("MEMAR bundle: unknown module " + name)
    var module = {exports: {}}
    cache[key] = module
    defs[key](module.exports, req, module)
    return module.exports
  }
  window.MemoraEngine = {
    types: req("./MemoraTypes"),
    objects: req("./MemoraObjects"),
    sample: req("./MemoraSampleData"),
    store: req("./MemoraStore"),
    storage: req("./MemoraStorage"),
    voice: req("./MemoraVoice"),
    detector: req("./MemoraDetector"),
  }
})()`

const template = fs.readFileSync(path.join(root, "web-sim", "app.template.html"), "utf8")
const marker = "/*__MEMORA_ENGINE__*/"
if (!template.includes(marker)) throw new Error("template is missing " + marker)
// The MEMAR logo, inlined so the page stays a single self-contained file.
const icon = "data:image/png;base64," + fs.readFileSync(path.join(root, "media", "brand", "memar-icon-128.png")).toString("base64")
const body = template.replace(marker, () => bundle).split("__MEMAR_ICON__").join(icon)

const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<meta name="description" content="MEMAR: reminders that live on your things. Web simulator of the SPECS Lens, running the same memory engine. Tap = pinch.">',
  '<meta name="theme-color" content="#0A1330">',
  `<link rel="icon" type="image/png" href="${icon}">`,
  `<link rel="apple-touch-icon" href="${icon}">`,
].join("\n")

fs.writeFileSync(path.join(root, "web-sim", "memora-sim.html"), body)
fs.writeFileSync(
  path.join(root, "web-sim", "index.html"),
  `<!doctype html>\n<html lang="en">\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
)
console.log("Built web-sim/index.html and web-sim/memora-sim.html")
