# Notes for the coding agent (technical facts, not design)

Design decisions live in `devpost/design-brief.md` (written from the owner's plan-lens interview). This file only records facts about the machine and the project that aren't obvious from the code.

## Machine
- Windows 11, Lens Studio **5.23.2** (Public, build 26081320), Node 24, Git. Claude Code 2.1.319 runs inside the Antigravity IDE.
- Project folder: `C:\Users\stranger\Projects\MEMAR` (`MEMAR.esproj`), made from the **SPECS Base Template** (`targetPlatform: Spectacles`, Spectacles Interaction Kit + UI Kit under `Packages/`). Kept outside `Downloads` on purpose: `Downloads\CLAUDE.md` belongs to another project and would load into every chat under it.
- The Lens is named **MEMAR**, the same as the folder (it was called MEMORA during most of the build; renamed on 9 Nov 2026 at the owner's request). `lensName` in the project settings is `MEMAR`. Internal code names (`Memora*` files and classes, the `memora.memories.v1` storage key) were kept on purpose so saved data and the tested build stay intact.
- Old leftovers, not part of this project: `Downloads\Memora` (wrong template: Default/Snapchat) and `Downloads\MEMAR` (an earlier copy of this project). Don't edit them.
- Lens Studio generates a **new MCP token on every launch** and rewrites `.mcp.json`. If Lens Studio was restarted, the `lens-studio` MCP tools stop working in an open chat: start a new chat in this folder.
- When the MCP is down, Lens Studio's own log still shows compile errors and `print()` output: `%LOCALAPPDATA%\Snap\Lens Studio\logs\LensStudioLog-<date>.txt` (newest file).
- The network here is sometimes flaky (npm and GitHub DNS failed once, then worked). Retry a failed download once before treating it as a real error.

## Engine (`Assets/Scripts/Memora`)
- Written and tested before the CLAD build (pre-existing code, disclosed in README). Don't rewrite it; build the scene and UI on top of it.
- `npm test` compiles the engine with strict TypeScript and runs 17 Node tests (TypeScript comes through npx, no global install).
- `MemoraApp` (component) owns the store and storage, seeds 4 demo memories when storage is empty, and exposes `selectObject`, `onSelectionChanged`, `onSaved`, `resetForTest`. Inputs: `seedDemoData` (default true), `resetOnStart` (turn on while recording takes).
- Demo seed: laptop 2 (report, internship email), keys 1 (parcel), bag 1 (charger), notebook 0. The two due dates are kept inside "today" (latest 11:30 PM), so the today strip reads 2 due today at any hour.
- Presets: `presetsFor(id)` and `presetInput(id, preset, now)` in `MemoraSampleData.ts`.
- Storage: one JSON string under `memora.memories.v1` in `global.persistentStorageSystem.store`. Persistence across sessions can't be shown in the preview: label it "feel unproven".

## Repo rules
- Never commit `.mcp.json`, `.codex/`, `.cursor/mcp.json`, `.vscode/mcp.json` or `.claude/settings.local.json` (they hold the local MCP token). `.gitignore` covers them; check `git status` before every commit.
- `Cache/`, `Workspaces/`, `Support/`, `.test-build/`, `node_modules/` are not committed.

## Owner
- Vikram, final-year B.Tech IT student. Prefers simple English (Hinglish is fine), short steps, and the "why" behind each step.
- He does the parts only a person can: the plan-lens answers, judging the Lens in the preview, recording the video, publishing the repo, and submitting on Devpost.

## Learned during the build (9 Nov 2026, evening)
- **Package pins.** The project uses SpectaclesInteractionKit 0.18.0 (template). The newest Asset Library versions of LEAF / AI Preview Agent (4.0.0) import `InteractionKit.lspkg/...` (Interaction Kit 4.0) and break compilation of the whole project. Installed and working: **Leaf 2.0.2**, **AiPreviewAgentInteract 2.0.1** (AiPreviewAgentInspect is 4.x; its unused examples are covered by `Assets/Scripts/Typings/AiPreviewAgentInspectCompat.d.ts`). Don't install or update packages without checking this. `PreviewInteractTool`'s first call auto-installs the 4.0 agent; if that happens, remove it and reinstall 2.0.1.
- **Materials.** A material asset created without a pass renders as a pink/black checkerboard. Prop materials use `simple_pbr` (Base.png + baseColor); the reticle and selection glow use `unlit`.
- **View and placement.** The SPECS preview view is ~37° wide. Cards and the Done list are placed by `MemoraUI/MemoraPlacement.ts`: in front of the object, toward the view centre, within 62 cm (beyond that, simulated pinches fail), scaled to a constant visual size.
- **World anchoring.** MemoraWorld re-anchors to the camera's facing at Lens start. Reset the preview camera *before* restarting the Lens when testing.
- **Testing in Preview.** Real user input = mouse click (InjectPreviewGesture touch start/move/end ~300 ms after hovering). `PreviewInteractTool` pinches work from the start pose; after `MovePreviewCamera` rotations they can miss.
- **Data.** Memories persist across preview restarts on this machine (`storage=persistent`). MemoraApp `resetOnStart` = on for demo takes; off keeps memories. Seed version 2 tops up starter memories for new objects once.
- **Undo** stays 8 s (MemoraMain `undoSeconds`).

## Video and brand pipeline (9 Nov 2026, late)
- Brand: `media/brand/memar-icon.svg` (app icon) and `memar-thumbnail.svg` (Devpost 3:2), rendered to PNG with headless Edge via playwright-core. PIL can't do the SVG blur/gradients as well.
- `tools/video/scenes.html` holds the animated scenes: the illustrated glasses-POV concept (door, kitchen, desk), the use-case montage and the live phone composite. `tools/video/render_html.js` steps `window.setTime(t)` frame by frame and screenshots, so rendering is deterministic.
- Live demo footage: `tools/video/record_sim.js` uses the DevTools screencast (`Page.startScreencast`) and saves real frame timestamps plus a mark for every tap. Playwright's `recordVideo` needs its own ffmpeg download, so don't use it.
- `tools/make_videos.py` caches TTS by text hash and HTML clips by params plus the `scenes.html` hash. Editing `scenes.html` re-renders every HTML clip (~10 min). The narration says "Memar" while the captions show MEMAR.
- The demo must stay under 3:00. It was about 2:55, so trim narration before adding scenes.
- Live demo hosting: `.github/workflows/pages.yml` deploys `web-sim/` to GitHub Pages. LFS isn't needed, because web-sim isn't LFS-tracked.
