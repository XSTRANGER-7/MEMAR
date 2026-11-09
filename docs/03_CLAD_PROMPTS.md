# CLAD prompts (paste one at a time)

Rules: one prompt per step, wait for it to finish, look at the result in Preview, then move on. `/clear` before prompt 1. A full build can take 30+ minutes.

---

## Prompt 1: the build (official prompt + MEMAR engine)

Paste the whole text from `docs/BUILD_PROMPT.md` as one message. It starts with the official Learn AR with SPECS prompt, then explains how to use the engine in `Assets/Scripts/Memora`: app root at the top of the hierarchy, stand-in and button names for LEAF, `presetsFor` / `presetInput` for + Add, and an honest "Couldn't save".

## Prompt 2: if it stops early or reports errors

> Check the Lens Studio Logger for errors and warnings, fix the verified ones, re-run Preview and the LEAF scenarios, and report PASS / FAIL / NOT RUN for each done criterion with evidence. Don't claim a test passed unless it ran.

## Prompt 3: design notes (use after you've walked around it)

Fix with design words, not code. Pick the notes that match what you see:

> Move the memory card 10 cm closer to the laptop and 5 cm lower so it sits right beside it. Re-run the tests.

> Make the Done buttons twice as big and the memory titles larger. They must read easily from 70 cm. Re-run the tests.

> The card is too crowded. Show at most 3 memories and a "+2 more" line. Re-run the tests.

> The badge dots are hard to see. Make them a brighter accent colour, 3 cm across, 4 cm above each object, with the count in white.

> Text on the cards looks dark. Use light text on mid-tone cards; nothing black, since black is transparent on SPECS.

> When I pinch Done, add a short tick animation and a soft confirmation sound before the row disappears.

## Prompt 4: final verification before recording

> Inspect the whole project. Run all LEAF scenarios from a fresh Preview and report PASS / FAIL / NOT RUN per done criterion with evidence. Then list every Logger error or warning. Fix verified errors only. Don't change MemoraStore behaviour.

## Prompt 5 (only if everything passes and you have > 2 hours left): one Release 2 feature

Pick **one**:

> Add a "Speak" button on the + Add panel. If SPECS ASR is available in this project, it captures one sentence and shows it as an editable preview with Save and Cancel; nothing saves without Save. If ASR isn't available in Preview, show "Voice works on glasses" and keep the presets. Never listen without the button.

> Add an "Image target" option for the notebook: if a tracked image target is set up, finding it calls MemoraApp.instance.selectObject("notebook", "image-target") after the user confirms. Keep the stand-in pinch as the fallback and label it clearly.

Don't add both. If it isn't solid in 45 minutes, revert it and record with the MVP.

## Prompt 6: README help

> Update README.md: replace the TODO placeholders with the real scene hierarchy, the Lens Studio version, the package versions under Packages/, and the LEAF results table. Keep the "Pre-existing code and assets" section accurate.
