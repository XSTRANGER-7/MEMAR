# MEMAR test plan

Three layers. Report each test honestly as PASS, FAIL or NOT RUN.

## Layer 1: engine unit tests (Node)

`npm test` from the project root compiles `Assets/Scripts/Memora` with strict TypeScript and runs **41 tests** in four files. Last result (9 Nov 2026, Windows, Node 24): **41 pass, 0 fail**.

| File | Tests | Covers |
|---|---|---|
| `tests/memora-store.test.js` | 17 | Create → recall → complete; empty/overlong title and unknown object rejected; Laptop never mixed with Keys; double-pinch guard; complete idempotent + Undo; edit/move/clear due; delete; overdue never "due today"; ordering; save/load round trip; corrupted or newer data never crashes; save after every change + reload (restart); persistent store adapter failures reported honestly; demo seed and presets valid; seed always "due today"; change listeners |
| `tests/memora-detector.test.js` | 8 | Look-to-recall: gaze hit/miss, big objects easier to aim at, distance limits, dwell locks once, switching targets, grace window, disabled detector, Scan view cone |
| `tests/memora-features.test.js` | 9 | Catalog (10 objects, 3 zones, small and big), zone layout faces the user, per-object seed counts, zone counts after complete/undo/delete, Done archive (order, restore, clear done), voice transcript cleaning and priority, seed top-up for existing users, storage extra values |
| `tests/memora-daily.test.js` | 7 | Routine (daily/weekly) memories: next occurrence at the same time, Undo/Restore leave no duplicate, roll-forward, repeat edit + save/load; Snooze; "Before you leave" checklist; presets/seed carry the routine flag |

## Layer 2: LEAF scenarios in Lens Studio

One scenario per done criterion, using real SIK pinches on the named objects. Each starts from `MemoraApp.instance.resetForTest()` (the demo seed).

| # | Done criterion | LEAF checks |
|---|---|---|
| 1 | Badges at start | Badge-laptop 2, Badge-keys 1, Badge-bag 1, Badge-notebook hidden |
| 2 | Recall by object | pinch Object-laptop → MemoryCard rows are laptop titles only, first "Submit the project report"; pinch Object-keys → card shows "Collect the parcel before leaving" |
| 3 | Done + Undo | DoneButton on the report → row gone, laptop badge 1, TodayStrip changes; UndoButton → back |
| 4 | Add from preset | Object-notebook → AddButton → Preset-Review meeting action items (twice quickly) → notebook badge 1 |
| 5 | Delete with confirm | details → DeleteButton → CancelDeleteButton keeps it; DeleteButton → ConfirmDeleteButton removes it |
| 6 | Zones | wallet/umbrella/medicine/fridge badges 1, door and bottle hidden; ZoneHint-entryway "Entryway · 2", ZoneHint-kitchen "Kitchen · 2" |
| 7 | Look-to-detect | gaze at keys (test hook or camera) → DetectReticle → DetectChip "Keys · 1 memory" → pinch chip → keys card |
| 8 | Done list | fridge Done on "Buy milk on the way back" → DoneListButton → ArchivePanel first item → RestoreButton puts it back |
| 9 | Voice | notebook → AddButton → SpeakButton (or transcript hook "remind me to print the lab report") → preview "Print the lab report" → SaveVoiceButton adds it; CancelVoiceButton adds nothing |
| 10 | Scan | ScanButton → ScanTag-* shown for objects in view with counts |
| 11 | Routine | medicine Done on vitamin D → badge stays 1, row "Tomorrow … · Daily"; Undo → no duplicate |
| 12 | Snooze | details → SnoozeButton → due time about +1 h |
| 13 | Before you leave | LeaveCheck lists Keys, Bag, Wallet, Umbrella; after completing them reads "All set to leave ✓" |
| 14 | Help | HelpButton → HelpCard; HelpCloseButton closes it |

Results: see README "Tests".

## Layer 3: manual Preview checks (you, before recording)

- [ ] Walk around with WASD: desk in front, slightly below eye level; entryway on the left and kitchen on the right, each a short head-turn away
- [ ] Text readable from where you stand; nothing dark disappearing; no pink/black checkerboards
- [ ] The card sits beside the object, not in front of your face, and never covers another object
- [ ] Every button reacts to a click (pinch) and highlights on hover
- [ ] Empty state: complete everything on an object → the card says something useful with + Add
- [ ] Voice works with your mic and internet (or shows a clear message without them)
- [ ] Logger: no red errors during the whole demo flow

## Labels for the README

- **Logic proven:** everything in layers 1–2 that passes.
- **Feel unproven:** persistence across restarts on real glasses, comfort over time, real recognition (look-to-detect is simulated from head direction), real hand tracking.
