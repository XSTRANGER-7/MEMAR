# Devpost submission (paste-ready, check the TODOs)

Submit at https://learn-specs.devpost.com/ → "Enter a submission". Have ready: project name, tagline, story, built-with tags, **public YouTube link**, **public GitHub repo link**.

---

**Project name:** MEMAR (MEMory + AR)

**Elevator pitch** (Devpost limit is 200 characters; this one is 166):
> MEMAR pins reminders to the things around you. Look at your keys on SPECS and see "collect the parcel". No app to open: just a glance, a pinch, or one spoken sentence.

Shorter alternatives:
- Reminders that live on your things, not in an app.
- An AR memory layer for SPECS: reminders show up on your laptop, keys and fridge right when you look at them.

**Short description** (for the Lens description or the top of the story):
> MEMAR is a Lens for SPECS that attaches memories to everyday objects: your laptop, keys, fridge and medicine box. Each object wears a small badge with how many things are waiting. Look at it or pinch it and a compact card shows them, most urgent first. Tick things off with Undo, add new ones from presets or one spoken sentence, let daily routines come back by themselves, and check "Before you leave" at the door.

**"Try it out" links** (Devpost lets you add several):
1. **Live demo** (works on any phone, no install): https://xstranger-7.github.io/MEMAR/, the web simulator running the same memory engine as the Lens. Published by `.github/workflows/pages.yml` once the repo is public and Pages → Source is set to GitHub Actions.
2. **Source code + the real Lens:** https://github.com/XSTRANGER-7/MEMAR. To run the Lens: clone it, open `MEMAR.esproj` in Lens Studio 5.23+, and use Preview (README → "Open and run").
3. **Video:** the public YouTube link to `media/MEMAR_Demo.mp4` (upload `media/MEMAR_Demo.srt` as captions).

Suggested line for the top of the story: *"Try it now on your phone: https://xstranger-7.github.io/MEMAR/ (tap = pinch). The SPECS Lens itself is in the repo and runs in Lens Studio's SPECS preview."*

**Images** (in `media/brand/`):
- Thumbnail, 3:2: `memar-thumbnail-1500x1000.png`
- Logo / icon, square: `memar-icon-1024.png` (also 512 and 128 px; source `memar-icon.svg`)

**Tagline:** Reminders that live on your things, not in an app.

## Inspiration
I miss reminders not because I didn't save them, but because they're buried in an app I don't open at the right moment. "Collect the parcel" belongs with my keys. "Submit the report" belongs with my laptop. "Take vitamin D" belongs with the medicine box. Glasses can put a reminder on the object itself.

## What it does
MEMAR is a Lens for SPECS that links memories to the things around you: a desk (laptop, keys, notebook, bag), an entryway (front door, wallet, umbrella) and a kitchen (fridge, medicine box, water bottle).

- Each object shows a small badge with how many things are waiting on it.
- Look at an object for a second (or pinch it), and a compact card opens right next to it, inside the narrow SPECS view, most urgent first.
- Pinch Done to tick a memory off, with Undo.
- Daily or weekly routines come back by themselves.
- "Later +1h" snoozes a memory.
- Add a memory from quick presets or by speaking one sentence. It saves only after you pinch Save.
- A "Before you leave" panel at the front door lists what's still pending on the things you carry.
- A thin strip on the desk edge shows today's counts, plus Scan, a Done list with Restore, and Help, instead of a floating dashboard.

The preview can't recognise real objects, so the room holds stand-in objects. Looking at one until it locks, or pinching it, is the "found it" moment. Both call the same `selectObject()` a real camera recogniser would call later, always with a confirm pinch.

## How we built it
- Planned with the Devpost Learn skill pack (`plan-lens`), which produced `devpost/design-brief.md`.
- Built by a coding agent (Claude Code) through **CLAD** with **Lens Studio** and the **Lens Studio MCP**, using Spectacles Interaction Kit and UI Kit. CLAD's SPECS Experience Builder built the scene and UI in three passes (desk MVP; zones + detection + voice + archive; daily-life features + polish). Each pass was checked in the preview with real SIK pinches, runtime queries and screenshots. CLAD's Live Lens Tester wrote the LEAF scenarios.
- The memory engine (`Assets/Scripts/Memora`) is pure TypeScript with no scene dependencies. It covers memories, routines, snooze, the Done archive, look-to-recall detection maths and voice transcript cleaning, plus a storage adapter over Lens persistent storage with corrupted-data handling. It has **41 Node unit tests**. The scene and UI are covered by **LEAF scenarios, one per done criterion**.

## Challenges
- **Designing for glasses instead of a screen.** We moved from a dashboard to information on the objects.
- **The narrow SPECS view (~37°).** Cards placed "beside" an object opened half out of view. MEMAR now places each card toward the middle of your view, within arm's reach, and keeps the object's badge visible.
- **Faking recognition honestly.** Look-to-detect is clearly a simulation and always needs a confirm pinch.
- **Replacing typing.** We use presets and a one-sentence voice capture that never saves without Save.
- **Tooling.** The newest LEAF and preview-agent packages need Interaction Kit 4.0 and broke compilation, so we pinned the versions that match the template's SIK 0.18.

## Accomplishments
All 14 of 14 LEAF scenarios pass in the Lens Studio preview (51 real SIK pinches, 0 retries), and all 41 engine unit tests pass. The Lens went from a one-desk MVP to three zones, look-to-detect, voice capture, routines and a leave-home check in one evening, every step verified in the preview.

## What we learned
TODO in your own words. For example, how "show it when it's needed, then get out of the way" changed the design, or what the narrow field of view taught you about placing UI.

## What's next
- Real recognition: an image target for one object, then on-device recognition with a confirm step.
- Testing on SPECS hardware (comfort, persistence across restarts).
- Shared household lists and location-based memories, both with consent.

## Limitations (be upfront)
- Tested in the Lens Studio preview only, not on SPECS hardware.
- Objects are stand-ins, and look-to-detect is simulated from head direction.
- Voice needs internet and a microphone.
- Memories are written to Lens persistent storage. They survive preview restarts on our laptop, but persistence on real glasses is unverified.

**Built with:** lens-studio, specs, spectacles-interaction-kit, spectacles-ui-kit, clad, lens-studio-mcp, leaf, typescript, claude-code, asr

## Feedback for Snap (form questions; drafted from the build log, edit in your own words)

**Where did you get stuck, or nearly quit?**
- **Package versions broke the whole build (where I nearly quit).** Midway through, the latest Leaf and AI Preview Agent Interact packages (4.0) got installed from the Asset Library. They import from `InteractionKit.lspkg/...`, but the SPECS Base Template ships Spectacles Interaction Kit 0.18.0. The whole project stopped compiling, with TypeScript errors about unresolved modules in those packages. Nothing in the install step warned about it. I had to remove both packages through the Editor API and pin Leaf 2.0.2 and AI Preview Agent Interact 2.0.1 to match SIK 0.18.
- **Silent pink checkerboards.** Twelve generated materials had no passes, so the stand-in objects rendered as pink and black checkerboards with no Logger error. I fixed them by adding passes through the Editor API.
- **Voice in Preview.** Speech recognition returned nothing, and my Lens showed "Couldn't hear that". The cause was the Preview microphone toggle, which is off by default, and nothing in the logs pointed to it. The ASR docs say it's "only available on Spectacles", so I wasn't sure Preview support was real. Stopping ASR also logs "update is null".
- **MCP connection.** Restarting Lens Studio issues a new MCP token, and the agent gets `ECONNREFUSED` until the whole agent session restarts. That lost context mid-build.
- **Testing in the narrow view.** The SPECS view is about 37° wide, so cards placed "beside" an object opened half off-screen. Simulated pinches also failed on targets farther than about 62 cm. After `MovePreviewCamera` rotations, `PreviewInteractTool` pinches missed; hovering and then clicking through `InjectPreviewGesture` worked. One LEAF scenario failed because someone clicked in the Preview while it ran.

**If Snap could fix one thing in CLAD or Lens Studio, what would it be?**
Make package installs version-aware. When CLAD or the Asset Library installs a package like Leaf or the AI Preview Agent, it should check the package's dependencies against the project's installed Spectacles Interaction Kit version. Then it should install a compatible version, or warn before installing. One automatic install of a 4.0 package broke compilation for the whole project, and finding the matching older versions took longer than building a feature. Runner-up: let the MCP reconnect after a Lens Studio restart without restarting the agent session.
