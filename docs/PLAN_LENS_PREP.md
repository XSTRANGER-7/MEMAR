# plan-lens interview prep (your notes, not the brief)

plan-lens asks one open question at a time and writes the brief from **your** answers. These are notes so you can answer confidently. Say them in your own words; change anything you disagree with. The bracketed numbers match what is built in the project; you can accept or change them.

Updated 9 Nov 2026 (evening): the build grew from one desk to three zones, plus look-to-detect, voice capture and a Done list. These notes cover the full version, so your answers line up with the Lens you'll demo.

---

**1. The idea: "What would you like to make for glasses?"**
MEMAR, a memory layer for the things around me. I save a reminder against an object, like my laptop, my keys or the fridge, and when I look at that object, the reminder is right there on it. Reminder apps are time-based; I want reminders that show up where they matter. I'm a final-year student: assignments live with my laptop, "collect the parcel" lives with my keys, "take vitamin D" lives with the medicine box.

**2. The spatial moment: "Picture the moment your Lens is at its best."**
I'm at my desk about to head out. Above my laptop there's a small glowing dot with a "2". I pinch the laptop, and a small card opens right beside it: "Submit the project report, today" at the top. I pinch Done, it ticks off and the dot drops to 1. I glance at my keys: their dot says 1, "Collect the parcel before leaving". On the way to the door the umbrella says "Carry the umbrella today". I never opened an app.

*Why glasses and not a phone:* on a phone I'd have to remember to open the app and search. On glasses the reminder sits on the object itself, and I only see it when I'm looking at that thing.

**3. Product or overlay**
It's an overlay on real objects. The real version would recognise my things with the camera. Preview can't recognise real things, so the stand-in is **virtual stand-in objects in three zones**. Two ways to do the "found it" moment, both honest stand-ins:
- **Look at it**: when I keep looking at a stand-in for about a second, a detection frame locks on and a small chip says "Laptop · 2 memories — pinch to open". It's simulated from where my head points, not real camera vision.
- **Pinch it** directly.
Either way it calls the same code a real recogniser would call later, and I always confirm with a pinch before anything opens.

**4. Where things live**
- **Desk** (the main moment): about [85 cm] in front of me, slightly below eye level. Laptop in the middle, keys on the left, notebook on the right, bag on a chair beside the desk.
- **Entryway** to my left (~1.5 m, turn my head): a small console table with my wallet and umbrella, and the front door behind it. Big and small things.
- **Kitchen** to my right (~1.5 m): a counter with a medicine box and a water bottle, and the fridge next to it.
- Each zone faces me. Things are real size.
- **Badge**: a small dot [~3 cm] just above each object with its pending count; no dot when nothing is pending.
- **Memory card**: opens beside the object I picked, facing me, never covering another object. At most [3] memories, most urgent first.
- **Today strip** on the front edge of the desk: "[8] pending · [3] due today", with small Scan, Look-to-detect and Done-list buttons. It's not a dashboard.
- **Zone hints** on the desk edge: "◀ Entryway · 2" and "Kitchen · 2 ▶" so I know something's waiting out of view.
- Light text on mid-tone cards, never dark, since black shows as see-through.

**5. Hands (and voice)**
- Pinch an object (or pinch the detection chip) → its card opens. Pinch another object → the card moves.
- Pinch **Done** → completes it; **Undo** shows for [4 s].
- Pinch **+ Add** → quick presets for that object, or **Speak**: I say one sentence ("remind me to print the lab report"), it shows "Print the lab report" and saves only when I pinch **Save**. **Cancel** saves nothing. The mic is on only between Speak and the end of that sentence. Presets are the button that does the same job if voice doesn't work.
- Pinch a memory's title → details. **Priority** cycles low/medium/high. **Delete** asks to confirm.
- **Scan** on the strip tags everything in view with its count for a few seconds.
- **Done list** on the strip shows what I finished, with **Restore**.
- Big targets. No typing.

**6. When it shows**
- Badges are always there but tiny; they're the only thing visible until I look at or pinch something.
- The detection frame shows only while I keep looking at one object; the chip hides when I look away.
- The card shows only after I pick an object, and hides on X or when I pick another one.
- Undo shows for [4 s]; "Saved to Notebook" fades after [2 s]; "Couldn't save" if a save fails.
- Things out of view: the zone hints on the desk edge point to them.

**7. Done criteria (things I can check in Preview)**
1. At start, the laptop badge shows 2, keys 1, bag 1, and the notebook has no badge.
2. Pinching the laptop opens a card beside it with only laptop memories, "Submit the project report" first. Pinching the keys moves the card and shows "Collect the parcel before leaving".
3. Pinching Done on "Submit the project report" removes it, the laptop badge drops to 1 and the today strip updates. Undo brings it back.
4. Pinching the notebook, + Add, then "Review meeting action items" adds it and the notebook badge shows 1. A quick double pinch still adds only one.
5. Opening details, Delete then Confirm removes the memory; Cancel keeps it.
6. Turning left and right: wallet 1, umbrella 1, medicine 1, fridge 1; the door and the bottle have no badge. The desk hints read "Entryway · 2" and "Kitchen · 2".
7. Looking at the keys for a second shows the detection frame, then "Keys · 1 memory"; pinching the chip opens the keys card.
8. Completing "Buy milk on the way back" on the fridge puts it first in the Done list; Restore puts it back.
9. Notebook → + Add → Speak → "remind me to print the lab report" shows "Print the lab report"; Save adds it (badge 1); Cancel adds nothing.
10. Scan tags every object in view with its count.

**Out of scope (if asked)**
Real camera recognition, typing, cloud sync, accounts, notifications, sharing with other people, location memories. Memories are saved with Lens persistent storage; persistence on real glasses is unproven until tested on SPECS.

**Risks (if asked)**
- The look-to-detect moment is simulated from head direction; real recognition needs camera access, a confirm step and a privacy review.
- Voice needs internet and sends speech to Snap's speech-to-text service; nothing is recorded or stored except the text I choose to save.
- Whether a badge on every object stays calm with many objects. Only real use will tell.

**If plan-lens asks about existing code**
"The project already has a tested memory engine in `Assets/Scripts/Memora` and a scene built with CLAD. The brief should describe that design."
