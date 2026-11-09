# Build prompt (paste into a fresh chat after plan-lens approves the brief)

Copy everything inside the box below and paste it as **one** message. The first paragraph is the official Learn AR with SPECS prompt; the rest tells CLAD how to use the engine that's already in the project.

---

Read devpost/design-brief.md and build it for SPECS. Follow the brief closely. Get the basic flow working first, then add detail. Write and run LEAF tests for each done criterion, and tell me which pass.

Also read docs/AGENT_NOTES.md (machine and project facts). This project already has a tested memory engine in Assets/Scripts/Memora. Use it, don't rewrite it (`npm test` must still pass, 17 tests):
- Add one SceneObject named "MemoraApp" with the MemoraApp component, at the top of the Scene Hierarchy so it wakes before the UI scripts. It owns the MemoraStore, storage and the selected object. Reach it with MemoraApp.instance.
- Stand-in objects use the ids and desk offsets in MemoraObjects.ts (laptop, keys, notebook, bag). Pinching a stand-in calls MemoraApp.instance.selectObject(id, "stand-in"); listen with onSelectionChanged. Name each stand-in "Object-<id>" so LEAF can find it.
- Cards read store.getPendingMemoriesByObject(id) and re-render on store.onChange. Done calls completeMemory, Undo calls undoCompleteMemory, Delete calls deleteMemory, priority changes use updateMemory. The + Add list comes from presetsFor(id) and saves with store.createMemory(presetInput(id, preset, Date.now())). Show the error string from a failed Result to the user, and show "Couldn't save" when MemoraApp.onSaved reports false. Never claim a save that didn't happen.
- Badges use store.pendingCountFor(id). The today strip uses store.getMemoryCounts(). Due labels use formatDue(memory, Date.now()).
- In LEAF scenarios, call MemoraApp.instance.resetForTest() at the start so each scenario begins from the demo seed.
- Use Spectacles Interaction Kit and UI Kit for every interaction. Give things clear names for LEAF: "Badge-<id>", "MemoryCard", "MemoryRow-<memoryId>", "DoneButton-<memoryId>", "AddButton", "Preset-<title>", "UndoButton", "CloseButton", "DeleteButton", "ConfirmDeleteButton", "CancelDeleteButton", "PriorityButton", "TodayStrip".
- SPECS displays are additive (black is transparent): light text on mid-tone surfaces, nothing that relies on black.

Report: the scene hierarchy you created, which done criteria pass in LEAF (PASS / FAIL / NOT RUN with evidence), and any criterion without a test.

---
