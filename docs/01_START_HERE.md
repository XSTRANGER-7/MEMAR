# MEMAR: start here (tonight's build plan)

**Deadline: Mon 9 Nov 2026, 5:00 PM EST = Tue 10 Nov, 3:30 AM IST.**
You do not need SPECS glasses. Everything runs in Lens Studio's Preview on your laptop.

## What the hackathon actually requires

| Requirement | What it means for you |
|---|---|
| A **new Lens for SPECS** | A Lens Studio project made from the SPECS Base Template |
| **Planned with the Devpost Learn skill pack** | You run `plan-lens` in your coding agent. It interviews you (20–30 min) and writes `devpost/design-brief.md`. You must answer the questions yourself. |
| **Built by an AI coding agent through CLAD** | CLAD (Snap's agent plugin) + Lens Studio MCP build the Lens from the brief |
| **Runs in Lens Studio Preview** | Every feature you demo must work in Preview with mouse + keyboard |
| **Video under 3 minutes**, public on YouTube | Screen recording of the Preview is ideal |
| **Public repo** | The Lens Studio project folder, with `devpost/` inside it |

Judging: Design, Technical Implementation (how well you used CLAD, Lens Studio and the MCP), Innovation/Idea, Presentation.

## What changed from your original blueprint, and why

| Blueprint idea | Problem in Preview / with judges | What we build instead |
|---|---|---|
| Floating dashboard + menus | The design rules judges use say "not a website floating in front of your face" | Memories live **on the objects**: a small badge above each object, a compact card opens beside it |
| Camera recognizes your laptop | Preview can't recognize real things | A **virtual desk with stand-in objects** (laptop, keys, notebook, bag). Pinching an object is the "found it" moment. Same code path a real recognizer would use later |
| Typing a title | Typing on glasses is slow, voice may not work in Preview | **Quick presets** per object (pinch to save). Voice is Release 2 |
| Persistence across restarts | Preview can't show memory across sessions | Storage is **built** (Lens persistent storage, tested adapter) but labelled "feel unproven" and kept out of the done criteria |

## Tonight's timeline (IST)

| Time | Step | Doc |
|---|---|---|
| 15:00–16:00 | Install Lens Studio, Node, Git, Claude Code. Create SPECS project. Install CLAD + skill pack | `02_SETUP_GUIDE.md` |
| 16:00–16:45 | Run `plan-lens`. Answer in your own words | `devpost/plan-lens-prep.md` |
| 16:45–17:00 | Copy the MEMAR core scripts into the project | `02_SETUP_GUIDE.md` step 7 |
| 17:00–18:30 | CLAD builds the Lens | `03_CLAD_PROMPTS.md` |
| 18:30–21:00 | Try it in Preview, fix with design notes, run LEAF | `03_CLAD_PROMPTS.md`, `04_TEST_PLAN.md` |
| 21:00–22:30 | Record + upload video | `05_DEMO_SCRIPT.md` |
| 22:30–00:30 | README, push repo public, submit on Devpost | `06_DEVPOST_SUBMISSION.md` |
| 00:30–03:30 | Buffer. Don't plan to use it | |

**Submit a working version by midnight IST**, then improve if there's time. Devpost lets you edit until the deadline.

## What's in this kit

```
Assets/Scripts/Memora/     tested memory engine (drop into your Lens project)
  MemoraTypes.ts           data model
  MemoraObjects.ts         laptop / keys / notebook / bag / other + desk layout
  MemoraStore.ts           create, recall by object, complete, undo, edit, delete, counts, due states
  MemoraStorage.ts         Lens persistent storage adapter + session fallback
  MemoraSampleData.ts      quick presets and the demo seed
  MemoraApp.ts             @component root: owns the store, selection, save status
tests/                     17 Node tests for the engine (npm test)
devpost/plan-lens-prep.md  your notes for the plan-lens interview (not the brief)
docs/                      this guide and the rest
README.md                  repo README template (update after the build)
```

## What I could not do for you (you must do these)

1. Install Lens Studio and run it (it's a desktop app; I work in a cloud Linux box).
2. Log in to Lens Studio with your Snapchat account.
3. Run `plan-lens` and answer the interview yourself (the rules require the learner to make the decisions).
4. Run CLAD inside Lens Studio (it needs the live Lens Studio MCP on your machine).
5. Look at the Lens in Preview and judge it.
6. Record the video, upload to YouTube, make the GitHub repo public, submit on Devpost.

The engine logic is already written and tested, so CLAD's job is the scene, the UI and the LEAF tests.
