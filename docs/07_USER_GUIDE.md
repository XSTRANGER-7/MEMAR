# MEMAR user guide

*Your real world. Your memories.* MEMAR puts reminders on the things they're about. A small dot above your laptop, keys or medicine box shows what's waiting, and pinching the thing opens its memories right beside it.

This guide covers: where MEMAR runs, the controls, every feature step by step, everyday routines for different people, how to test it, and what to do if something goes wrong.

---

## 1. Where can I use it?

| Device | Works? | How |
|---|---|---|
| **Laptop, Lens Studio Preview** | ✅ Yes, this is the main way | Open the project in Lens Studio and use the Preview panel (section 2). No glasses needed. This is what the hackathon judges use. |
| **Snap SPECS glasses** | ✅ Built for them, not yet tested on hardware | Pair the glasses with the Spectacles app on your phone, then in Lens Studio use the Preview Lens / send-to-Spectacles button (top-right) and choose your glasses. Real hands replace the mouse. |
| **Phone (Snapchat or the Spectacles app)** | ❌ No | MEMAR is a SPECS glasses Lens: it places things around you in 3D and uses hand pinches. The Spectacles phone app only pairs and manages the glasses; it doesn't run Lenses. A phone version would be a different Lens (Snapchat camera, touch controls). To show MEMAR on a phone, share the demo video. |

### Test without glasses or Lens Studio: the web simulator
`web-sim/` is a page that runs MEMAR's **real memory engine** (the same `Assets/Scripts/Memora` code the Lens uses) with the desk, entryway and kitchen as tappable objects. Tap = pinch. It's for testing the everyday flows on any screen, including your phone; the 3D, hand and look-to-detect parts are only in the Lens.
- **On the laptop:** run `npm run sim:serve` in the project folder, then open http://localhost:8080. Voice works here in Chrome (it asks for the microphone).
- **On your phone (same Wi-Fi):** keep `npm run sim:serve` running and open `http://<your laptop's IP>:8080` on the phone. Allow Python through the Windows firewall if asked. Voice is blocked on plain `http` links on phones, so use "type what you would say" instead (same voice-to-memory path).
- **Hosted link for anyone (judges, friends):** push the repo to a public GitHub repo, then turn on Settings → Pages → Source: **GitHub Actions**. The included workflow publishes `web-sim/` to https://xstranger-7.github.io/MEMAR/. Anyone can open that on a phone, with no install and no account. Voice works there too, because the page is `https`.
- Memories stay in that browser; **Reset demo** (tap twice) starts again from the 8 sample memories.

---

## 2. Run it in Lens Studio (laptop)

1. Open **Lens Studio** and open `MEMAR.esproj` (the Lens is called MEMAR).
2. Find the **Preview** panel. If the Lens isn't running, press the refresh/reset button in the Preview panel.
3. To start fresh every time (recommended for demos), select **MemoraApp** in the Scene Hierarchy and tick **resetOnStart** in the Inspector. Untick it if you want your memories to stay between runs.

### Controls (Interactive Preview)

| You want to… | Do this |
|---|---|
| Walk | **W A S D** |
| Go down / up | **Q / E** |
| Look around | **Right-drag** with the mouse (or hold **Shift**) |
| Pinch (tap) something | **Click** it |
| Look at something | Turn so it's in the middle of your view and hold still for about a second |

You start sitting at a **desk**. The **entryway** (front door) is to your **left**, the **kitchen** to your **right**. Turn your head (right-drag) to see them.

---

## 3. Every feature, step by step

### See what's waiting: badges
Each object has a small orange dot with a number: how many memories are waiting on it. No dot means nothing is waiting. At the start: laptop 2, keys 1, bag 1, wallet 1, umbrella 1, medicine 1, fridge 1.

### Open an object's memories
- **Pinch it**: click the laptop. A card opens right next to it, inside your view and within arm's reach, with its memories most urgent first (overdue → high priority → soonest). The object's dot stays visible, so you see it change.
- **Clicking tip (Preview):** move the mouse over the thing first (a small ring cursor appears), then click.
- **Or just look at it**: hold your gaze on the keys for about a second. A cyan frame locks on and a chip says "Keys · 1 memory". Pinch the chip to open the card.
  - In the preview this "detection" is simulated from where your head points. On real glasses a camera-based recogniser would do the same job. MEMAR always asks you to confirm with a pinch.
- Pinch another object and the card moves there. Pinch **X** to close it.

### Tick something off: Done and Undo
1. On the card, pinch the green **✓** next to a memory.
2. It disappears, the badge drops by one, and the strip on the desk edge updates.
3. Pinched by mistake? Pinch **Undo** within 8 seconds.

**Routine memories** (marked *Daily* or *Weekly*), like "Take vitamin D after lunch", come back by themselves. After Done, the card says "back tomorrow 2:00 PM" and the same reminder is waiting for tomorrow.

### Add a memory without typing
1. Open an object's card and pinch **+ Add**.
2. Pick one of its quick presets. Each object has its own, for example "Pack the charger" for the bag or "Buy milk on the way back" for the fridge.
3. "Saved to Bag" confirms it, and the badge goes up.

### Add a memory by voice
0. **Preview only, once:** turn on the Preview microphone. It's the **microphone icon at the bottom-left of the Preview panel**, next to the speaker icon. When it's off it has a line through it; click it so the line goes away. Windows may ask to allow Lens Studio to use the microphone: allow it.
1. In **+ Add**, pinch **Speak**.
2. Say one sentence, for example *"remind me to print the lab report"*.
3. MEMAR shows **"Print the lab report"**. Pinch **Save** to keep it, or **Cancel** to throw it away.
   - The microphone is on only between Speak and the end of that one sentence. Nothing is recorded; only the text you save is stored.
   - Voice needs internet (Snap's speech-to-text service) and a working laptop mic. Saying "urgent" or "important" makes it high priority.

### Details: priority, repeat, snooze, delete
Pinch a memory's title to open its details (note, due time, priority, when it was created).
- **Priority** cycles Low → Medium → High.
- **Repeat** cycles Once → Daily → Weekly.
- **Later +1h** snoozes it an hour.
- **Delete** asks you to confirm: **Confirm** removes it, **Cancel** keeps it.

### The desk strip
On the front edge of the desk: **"8 pending · 3 due today"**, plus small buttons:
- **Scan**: tags every object in view with its count for a few seconds.
- **Look to detect**: turns the look-to-open feature on or off.
- **Done list**: what you've finished. **Restore** puts a memory back; **Clear done** empties the list.
- **?**: a short how-to card.

The desk also shows hints like **"◀ Entryway · 2"** and **"Kitchen · 2 ▶"** when something is waiting outside your view.

### Before you leave (at the front door)
Beside the front door, a small panel lists what's still pending on the things you carry: keys, bag, wallet, umbrella, water bottle. For example, "Keys · Collect the parcel before leaving". When everything's done it reads **"All set to leave ✓"**.

---

## 4. Everyday use for different people

| Who | A normal day with MEMAR |
|---|---|
| **Student** | Laptop: "Submit the project report, today 6 PM". Notebook: "Copy formulas for tomorrow's exam". Bag: "Return the library book". Glance at the desk before class, tick things off, and check the door panel on the way out. |
| **Working professional** | Laptop: "Reply to the internship email" or a client follow-up. Wallet: "Top up the metro card". Keys: "Collect the parcel before leaving". The "Before you leave" panel catches the errand you'd forget. |
| **Health and medicines (any age)** | Medicine box: "Take vitamin D after lunch" as a **daily** routine. Bottle: "Refill the water bottle", daily. It comes back every day by itself, and the high-priority dot is easy to spot. |
| **Home and family** | Fridge: "Buy milk on the way back", "Finish the leftovers". Door: "Switch off the lights before leaving" (daily). Umbrella: "Carry the umbrella today". |
| **People who don't like typing** | Everything works with presets and pinches. Voice is optional. Big buttons, light text, one card at a time. |

---

## 5. How to test it

### Quick test as a user (10 minutes)
Start fresh (resetOnStart on), then check each line:

1. Badges: laptop 2, keys 1, bag 1, notebook none.
2. Pinch the laptop: the card shows "Submit the project report" first. Pinch the keys: the card moves and shows "Collect the parcel before leaving".
3. Done on the report: the badge drops to 1 and the strip changes. Undo brings it back.
4. Notebook → + Add → "Review meeting action items": the notebook badge shows 1. A quick double pinch still adds only one.
5. Details → Delete → Cancel keeps it; Delete → Confirm removes it.
6. Turn left and right: wallet 1, umbrella 1, medicine 1, fridge 1; the door and bottle have no dot. The desk hints say "Entryway · 2" and "Kitchen · 2".
7. Look at the keys for a second: the frame and the "Keys · 1 memory" chip appear. Pinch the chip and the keys card opens.
8. Fridge → Done on "Buy milk on the way back" → Done list shows it first → Restore puts it back.
9. Notebook → + Add → Speak → "remind me to print the lab report" → Save: added. Cancel: nothing added.
10. Scan tags the objects in view with their counts.
11. Medicine → Done on vitamin D: "back tomorrow", the badge stays 1, and Undo leaves no duplicate.
12. Details → Later +1h moves the due time.
13. The door panel lists Keys, Bag, Wallet, Umbrella; finish those and it says "All set to leave ✓".
14. **?** opens the help card; X closes it.

### Automatic tests
- **Engine (Node):** in a terminal in the project folder, run `npm test`. Expect **41 pass, 0 fail**. This checks the memory logic: saving, ordering, Done/Undo, routines, snooze, the leave-home check, detection maths, voice clean-up and corrupted data.
- **LEAF (inside Lens Studio):** each done criterion has a LEAF scenario that pinches the real buttons. Open the LEAF panel in Lens Studio and run all, or ask Claude: "Run all LEAF scenarios and report PASS/FAIL".

---

## 6. Honest limits

- **Stand-ins:** the preview can't see real objects, so the desk, door and fridge are virtual stand-ins. Look-to-detect is simulated from head direction.
- **Voice** needs internet and a microphone.
- **Saved memories:** stored with Lens persistent storage. In Lens Studio they survive preview restarts on this laptop. Whether they survive a restart on real glasses is unproven until tested on SPECS.
- **Not tested on SPECS hardware yet.** Comfort over time and real hand tracking are "feel unproven".
- **Privacy:** no camera capture, no recording, nothing about other people. The mic is used only after you pinch Speak.

---

## 7. If something goes wrong

| Problem | Fix |
|---|---|
| Preview is empty or stuck | Press the Preview reset button. Check the Logger panel for red errors. |
| Counts don't match this guide | Tick **resetOnStart** on MemoraApp and reset the preview. |
| Voice says "Couldn't hear that" | Turn on the Preview microphone (bottom-left mic icon in the Preview panel; no line through it). Check Windows Settings → Privacy → Microphone lets desktop apps use it. Start speaking within 10 seconds of pinching Speak. Or use a preset. |
| Voice says it needs internet / sign-in | Speech-to-text runs on Snap's service: connect to the internet and make sure you're signed in to Lens Studio (top-right). |
| An object looks pink and black | A material is missing. Tell Claude: "an object renders as a pink checkerboard". |
| Claude can't reach Lens Studio | Lens Studio makes a new connection token each time it starts. Close Claude, keep Lens Studio open, start Claude again in this folder. |
