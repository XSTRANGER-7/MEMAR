"""MEMAR videos: a ~30 s intro teaser and a ~2:50 narrated demo with captions.

Demo storyboard
  1. Concept opener: illustrated first-person scenes "through SPECS" (entryway, kitchen, desk) with
     world-locked MEMAR overlays, clearly labelled as a concept mockup (tools/video/scenes.html).
  2. Brand and problem.
  3. Use-case montage: routines, things you forget, deadlines, errands, the leave check, hands-free capture.
  4. The real Lens: captures from the Lens Studio SPECS preview (media/shots).
  5. Live demo: a real-time recording of the web simulator (same memory engine) in a phone frame.
  6. How it's built, honest status, end card.

Run from the project root:
  node tools/video/record_sim.js web-sim/index.html media/build/sim   (records the live demo once)
  python tools/make_videos.py            (both videos)
  python tools/make_videos.py intro|demo (one)
Needs: ffmpeg, Pillow, numpy, edge-tts (internet for the voice), Microsoft Edge, and playwright-core for
Node (npm i --no-save playwright-core@1.47.2, or point NODE_PATH at an install).
Writes media/MEMAR_Intro.mp4, media/MEMAR_Demo.mp4, media/MEMAR_Demo.srt and media/MEMAR_Demo_script.md.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "media", "shots")
BUILD = os.path.join(ROOT, "media", "build")
OUT = os.path.join(ROOT, "media")
BRAND = os.path.join(ROOT, "media", "brand")
VIDEO_TOOLS = os.path.join(ROOT, "tools", "video")
SCENES_HTML = os.path.join(VIDEO_TOOLS, "scenes.html")
SIM_DIR = os.path.join(BUILD, "sim")
FONTS = r"C:\Windows\Fonts"
W, H = 1920, 1080
FPS = 30
VOICE = "en-US-AvaNeural"
RATE = "+4%"

# Palette: brand navy and cyan; orange stays for the Lens's count badges.
BG_TOP = (16, 29, 66)
BG_BOT = (5, 9, 24)
INK = (244, 247, 252)
DIM = (169, 180, 198)
ORANGE = (240, 138, 93)
CYAN = (92, 225, 255)
BLUE = (61, 123, 255)
PANEL = (22, 32, 58)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def font_bahn(size):
    f = ImageFont.truetype(os.path.join(FONTS, "bahnschrift.ttf"), size)
    try:
        f.set_variation_by_name("Bold")
    except Exception:
        pass
    return f


F_TITLE = font("segoeuib.ttf", 76)
F_SUB = font("segoeui.ttf", 36)
F_CAP = font("segoeuisl.ttf", 38)
F_STEP = font("seguisb.ttf", 26)
F_TAG = font("segoeuil.ttf", 52)
F_BIG = font("segoeuib.ttf", 92)


def run(cmd, **kw):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, **kw)


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


# ── Frames ────────────────────────────────────────────────────────────────────────────────
_BG = None


def background():
    global _BG
    if _BG is None:
        t = np.linspace(0, 1, H)[:, None]
        s = np.linspace(0, 1, W)[None, :]
        k = np.clip(0.6 * t + 0.4 * s, 0, 1)[..., None]
        arr = np.array(BG_TOP, float) * (1 - k) + np.array(BG_BOT, float) * k
        glow = Image.new("RGB", (W, H), (0, 0, 0))
        g = ImageDraw.Draw(glow)
        g.ellipse((-300, 600, 700, 1500), fill=(25, 50, 120))
        g.ellipse((1300, -400, 2300, 500), fill=(15, 85, 115))
        glow = glow.filter(ImageFilter.GaussianBlur(220))
        arr = np.clip(arr + np.array(glow, float) * 0.6, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr).convert("RGBA")
        grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(grid)
        for x in range(0, W, 50):
            d.line([(x, 0), (x, H)], fill=(255, 255, 255, 9), width=2)
        for y in range(0, H, 50):
            d.line([(0, y), (W, y)], fill=(255, 255, 255, 9), width=2)
        _BG = Image.alpha_composite(img, grid).convert("RGB")
    return _BG.copy()


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width, im.height), radius, fill=255)
    out = Image.new("RGBA", im.size)
    out.paste(im, (0, 0), mask)
    return out


def paste_shadowed(canvas, im, xy, radius=28, shadow=40):
    x, y = xy
    sh = Image.new("RGBA", (im.width + shadow * 2, im.height + shadow * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((shadow, shadow, shadow + im.width, shadow + im.height), radius, fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(shadow / 2))
    canvas.alpha_composite(sh, (x - shadow, y - shadow + 12))
    r = rounded(im.convert("RGB"), radius)
    canvas.alpha_composite(r, (x, y))
    ImageDraw.Draw(canvas).rounded_rectangle((x, y, x + im.width, y + im.height), radius, outline=(255, 255, 255, 40), width=2)


def load_shot(name):
    im = Image.open(os.path.join(SHOTS, name)).convert("RGB")
    if name.startswith("s"):
        # Crop to the SPECS display area of the preview render (drop the darker side margins).
        im = im.crop((175, 0, 1565, im.height))
    return im


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


def caption_band(canvas, text):
    d = ImageDraw.Draw(canvas)
    lines = wrap(d, text, F_CAP, 1500)
    lh = 50
    band_h = lh * len(lines) + 40
    y0 = H - band_h - 34
    band = Image.new("RGBA", (W, band_h + 34), (0, 0, 0, 0))
    ImageDraw.Draw(band).rectangle((0, 0, W, band_h + 34), fill=(8, 11, 16, 185))
    canvas.alpha_composite(band, (0, y0 - 6))
    for i, ln in enumerate(lines):
        tw = d.textlength(ln, font=F_CAP)
        d.text(((W - tw) / 2, y0 + 14 + i * lh), ln, font=F_CAP, fill=INK)


_ICONS = {}


def icon(size):
    if size not in _ICONS:
        _ICONS[size] = Image.open(os.path.join(BRAND, "memar-icon-1024.png")).convert("RGBA").resize((size, size), Image.LANCZOS)
    return _ICONS[size]


def wordmark(canvas, x, y, size, center=False):
    """MEM in white + AR in the brand gradient, letter-spaced like the logo."""
    f = font_bahn(size)
    d = ImageDraw.Draw(canvas)
    sp = size * 0.06
    width = lambda s: sum(d.textlength(c, font=f) for c in s) + sp * (len(s) - 1)
    total = width("MEMAR")
    if center:
        x = (W - total) / 2
    cx = x
    for c in "MEM":
        d.text((cx, y), c, font=f, fill=INK)
        cx += d.textlength(c, font=f) + sp
    aw, ah = int(width("AR")) + 6, int(size * 1.35)
    mask = Image.new("L", (aw, ah), 0)
    md = ImageDraw.Draw(mask)
    mx = 0
    for c in "AR":
        md.text((mx, 0), c, font=f, fill=255)
        mx += md.textlength(c, font=f) + sp
    gx = np.linspace(0, 1, aw)[None, :]
    gy = np.linspace(0, 1, ah)[:, None]
    k = np.clip(0.5 * gx + 0.5 * gy, 0, 1)[..., None]
    grad = (np.array((140, 245, 255), float) * (1 - k) + np.array(BLUE, float) * k).astype(np.uint8)
    canvas.paste(Image.fromarray(grad), (int(cx), int(y)), mask)
    return total


def brand(canvas):
    canvas.alpha_composite(icon(48), (108, 52))
    wordmark(canvas, 170, 56, 34)


def frame_shot(shot, title, sub, caption=None, step=None, intro=False):
    canvas = background().convert("RGBA")
    brand(canvas)
    d = ImageDraw.Draw(canvas)
    im = load_shot(shot)
    h_ = 750 if caption else 880
    im = im.resize((int(im.width * h_ / im.height), h_), Image.LANCZOS)
    if shot.startswith("w"):
        x = W - im.width - 260
        paste_shadowed(canvas, im, (x, 118 if caption else 100), radius=46)
    else:
        x = W - im.width - 110
        paste_shadowed(canvas, im, (x, 118 if caption else 110))
    left_w = x - 200
    ty = 360 if not intro else 380
    if step:
        d.text((110, ty - 60), step.upper(), font=F_STEP, fill=CYAN)
    fnt = F_TITLE if not intro else F_BIG
    for i, ln in enumerate(wrap(d, title, fnt, left_w)):
        d.text((106, ty + i * (fnt.size + 10)), ln, font=fnt, fill=INK)
        last = ty + (i + 1) * (fnt.size + 10)
    if sub:
        for i, ln in enumerate(wrap(d, sub, F_SUB, left_w)):
            d.text((110, last + 24 + i * 48), ln, font=F_SUB, fill=DIM)
    d.rounded_rectangle((110, ty - 18, 190, ty - 11), 3, fill=CYAN)
    if caption:
        caption_band(canvas, caption)
    return canvas.convert("RGB")


def frame_card(big, lines=(), caption=None, kicker=None, stats=None):
    canvas = background().convert("RGBA")
    d = ImageDraw.Draw(canvas)
    if big == "MEMAR":
        top = 120 if caption else 150
        canvas.alpha_composite(icon(300), ((W - 300) // 2, top))
        wordmark(canvas, 0, top + 330, 150, center=True)
        y = top + 540
    else:
        brand(canvas)
        if kicker:
            kw = d.textlength(kicker.upper(), font=F_STEP)
            d.text(((W - kw) / 2, 250), kicker.upper(), font=F_STEP, fill=CYAN)
        y = 300
        for ln in wrap(d, big, F_BIG, 1500):
            tw = d.textlength(ln, font=F_BIG)
            d.text(((W - tw) / 2, y), ln, font=F_BIG, fill=INK)
            y += F_BIG.size + 16
        y += 20
    for ln in lines:
        tw = d.textlength(ln, font=F_TAG)
        d.text(((W - tw) / 2, y), ln, font=F_TAG, fill=DIM)
        y += 70
    if stats:
        n = len(stats)
        bw, gap = 420, 40
        x0 = (W - (n * bw + (n - 1) * gap)) / 2
        for i, (num, label) in enumerate(stats):
            bx = x0 + i * (bw + gap)
            d.rounded_rectangle((bx, y + 20, bx + bw, y + 220), 26, fill=PANEL, outline=(92, 225, 255, 90), width=2)
            nw = d.textlength(num, font=F_BIG)
            d.text((bx + (bw - nw) / 2, y + 40), num, font=F_BIG, fill=CYAN)
            lw = d.textlength(label, font=F_SUB)
            d.text((bx + (bw - lw) / 2, y + 156), label, font=F_SUB, fill=INK)
    if caption:
        caption_band(canvas, caption)
    return canvas.convert("RGB")


# ── Audio ─────────────────────────────────────────────────────────────────────────────────
def spoken(text):
    # Captions show MEMAR; the voice says it as a word.
    return text.replace("MEMAR", "Memar")


def vo_file(text):
    say = spoken(text)
    path = os.path.join(BUILD, "vo_" + hashlib.sha1(f"{VOICE}|{RATE}|{say}".encode()).hexdigest()[:12] + ".mp3")
    if not (os.path.exists(path) and os.path.getsize(path) > 1000):
        subprocess.run([sys.executable, "-m", "edge_tts", f"--voice={VOICE}", f"--rate={RATE}", f"--text={say}", f"--write-media={path}"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return path


def plan_vo(segs, lead=0.5, gap=0.3, tail=1.35, min_dur=0.0):
    """segs: text, or (text, at) for a fixed start time. Returns ([{text, path, at, d}], scene duration)."""
    out, t = [], lead
    for s in segs:
        text, at = s if isinstance(s, tuple) else (s, None)
        path = vo_file(text)
        d = probe_duration(path)
        if at is None:
            at = t
        elif out and at < out[-1]["at"] + out[-1]["d"] + 0.1:
            print(f"  note: '{text[:40]}…' moved to avoid overlapping the previous line")
            at = out[-1]["at"] + out[-1]["d"] + 0.15
        out.append({"text": text, "path": path, "at": at, "d": d})
        t = at + d + gap
    return out, max(min_dur, out[-1]["at"] + out[-1]["d"] + tail)


def music(path, seconds, energetic):
    sr = 44100
    n = int(seconds * sr)
    t = np.arange(n) / sr
    out = np.zeros(n)
    hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
    chords = [[48, 55, 59, 64, 71], [45, 52, 55, 60, 67], [41, 48, 52, 57, 64], [43, 50, 55, 59, 66]]  # Cmaj7 Am7 Fmaj7 G
    bar = 4.0
    for ci in range(int(seconds / bar) + 2):
        notes = chords[ci % 4]
        s, e = ci * bar, ci * bar + bar + 1.5
        idx = (t >= s) & (t < e)
        tt = t[idx] - s
        env = np.minimum(1, tt / 1.2) * np.clip((e - s - tt) / 1.5, 0, 1)
        for m in notes:
            f = hz(m)
            v = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 1.003 * tt) + 0.12 * np.sin(2 * np.pi * 2 * f * tt)
            out[idx] += 0.06 * env * v
        if energetic:
            step = 60 / 104 / 2  # eighth notes at 104 bpm
            arp = [notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[4] + 12]
            k = 0
            p = s
            while p < s + bar:
                i0, i1 = int(p * sr), min(n, int((p + 0.6) * sr))
                if i0 < n:
                    tp = np.arange(i1 - i0) / sr
                    out[i0:i1] += 0.05 * np.exp(-tp * 7) * np.sin(2 * np.pi * hz(arp[k % 4]) * tp)
                k += 1
                p += step
    if energetic:  # soft kick on the beat
        beat = 60 / 104
        p = 0.0
        while p < seconds:
            i0, i1 = int(p * sr), min(n, int((p + 0.25) * sr))
            tp = np.arange(i1 - i0) / sr
            out[i0:i1] += 0.18 * np.exp(-tp * 18) * np.sin(2 * np.pi * (55 + 60 * np.exp(-tp * 30)) * tp)
            p += beat
    fade = int(1.5 * sr)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade * 2:] *= np.linspace(1, 0, fade * 2)
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.8
    stereo = np.stack([out, np.roll(out, 220)], axis=1)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((stereo * 32767).astype(np.int16).tobytes())


# ── Clips ─────────────────────────────────────────────────────────────────────────────────
def still_clip(frame, seconds, key, zoom):
    fpath = os.path.join(BUILD, f"{key}.png")
    frame.save(fpath)
    out = os.path.join(BUILD, f"{key}.mp4")
    frames = int(round(seconds * FPS))
    vf = (
        f"scale=3840:2160,zoompan=z='1+{zoom}*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d=1:s={W}x{H}:fps={FPS},format=yuv420p"
    )
    run(["ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-t", f"{seconds:.3f}", "-i", fpath,
         "-vf", vf, "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", out])
    return out


def html_clip(key, params):
    """Renders an animated scene from tools/video/scenes.html (cached by its parameters and source)."""
    params = dict(params, fps=FPS)
    blob = json.dumps(params, sort_keys=True)
    with open(SCENES_HTML, "rb") as f:
        src = f.read()
    h = hashlib.sha1(blob.encode() + src).hexdigest()[:12]
    out = os.path.join(BUILD, f"html_{key}_{h}.mp4")
    if os.path.exists(out):
        return out
    pj = os.path.join(BUILD, f"html_{key}.json")
    with open(pj, "w", encoding="utf-8") as f:
        f.write(blob)
    fdir = os.path.join(BUILD, f"frames_{key}")
    print(f"  rendering {key} ({params['dur']:.1f} s)…")
    subprocess.run(["node", os.path.join(VIDEO_TOOLS, "render_html.js"), SCENES_HTML, pj, fdir], check=True)
    run(["ffmpeg", "-y", "-framerate", str(FPS), "-i", os.path.join(fdir, "%05d.jpg"), "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "17", "-pix_fmt", "yuv420p", out])
    shutil.rmtree(fdir, ignore_errors=True)
    return out


def assemble(name, scenes, trans, energetic, music_db):
    """scenes: [{clip, dur, vos: [{path, at, d, text}]}] → media/MEMAR_<Name>.mp4"""
    durs = [sc["dur"] for sc in scenes]
    offs, acc = [], 0.0
    for i in range(1, len(scenes)):
        acc += durs[i - 1] - trans
        offs.append(acc)
    starts = [0.0] + offs
    total = sum(durs) - trans * (len(scenes) - 1)

    inputs, fl = [], []
    for i, sc in enumerate(scenes):
        inputs += ["-i", sc["clip"]]
        fl.append(f"[{i}:v]settb=AVTB,fps={FPS},format=yuv420p,setsar=1[n{i}]")
    last = "[n0]"
    for i in range(1, len(scenes)):
        kind = "fade" if i % 3 else "smoothleft"
        fl.append(f"{last}[n{i}]xfade=transition={kind}:duration={trans}:offset={offs[i - 1]:.3f}[v{i}]")
        last = f"[v{i}]"
    fl.append(f"{last}fade=t=in:st=0:d=0.6,fade=t=out:st={total - 0.8:.3f}:d=0.8[vout]")

    mus = os.path.join(BUILD, f"{name}_music.wav")
    music(mus, total + 0.5, energetic)
    a_inputs = ["-i", mus]
    mix = []
    k = len(scenes) + 1
    for i, sc in enumerate(scenes):
        for vo in sc.get("vos", []):
            a_inputs += ["-i", vo["path"]]
            ms = int((starts[i] + vo["at"]) * 1000)
            fl.append(f"[{k}:a]adelay={ms}|{ms},apad[a{k}]")
            mix.append(f"[a{k}]")
            vo["start"] = ms / 1000
            k += 1
    fl.append(f"[{len(scenes)}:a]volume={music_db}dB[mus]")
    fl.append(f"[mus]{''.join(mix)}amix=inputs={len(mix) + 1}:normalize=0:duration=first,atrim=0:{total:.3f},"
              f"loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.95[aout]")
    out = os.path.join(OUT, f"MEMAR_{name.capitalize()}.mp4")
    run(["ffmpeg", "-y", *inputs, *a_inputs, "-filter_complex", ";".join(fl), "-map", "[vout]", "-map", "[aout]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", out])
    return out, total


def srt_time(s):
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


# ── Demo storyboard ───────────────────────────────────────────────────────────────────────
def sim_scene():
    """Live demo: the recorded simulator run, sped up slightly, with narration on the real tap times."""
    with open(os.path.join(SIM_DIR, "frames.json"), encoding="utf-8") as f:
        rec = json.load(f)
    m = {k["label"]: k["t"] for k in rec["marks"]}
    speed = 1.15
    rs = max(0.0, m["laptop"] - 0.8)
    at = lambda label: (m[label] - rs) / speed
    dur = (rec["end"] - rs) / speed
    params = dict(scene="sim", frames=rec["frames"], speed=speed, recStart=rs,
                  steps=[0, at("notebook") - 0.2, at("add2") - 0.2, at("scroll-kitchen") - 0.2, at("scroll-leave") - 0.2])
    vo = [
        ("Now watch it run live, on a phone, with the same memory engine. Done, and undo.", 0.3),
        ("Add to the notebook from a preset.", at("notebook")),
        ("Or say it in one sentence. It becomes a clean title, saved only when I tap Save.", at("voice") - 0.3),
        ("Vitamin D is a daily routine. Done, and it's already back for tomorrow.", at("scroll-kitchen")),
        ("The door check updates, and the done list keeps everything I finished.", at("scroll-leave")),
    ]
    return dict(kind="html", params=params, vo=vo, min_dur=dur)


def demo_storyboard():
    shot = lambda f, title, sub, step, vo: dict(kind="shot", args=dict(shot=f, title=title, sub=sub, step=step), vo=[vo])
    return [
        # 1. Concept: how it could feel on real glasses (illustration, labelled on screen).
        dict(kind="html", params=dict(scene="door"), tail=1.1, vo=[
            "Imagine a normal morning, a few weeks from now, with SPECS on. You grab your keys, and MEMAR notices: collect the parcel before you leave.",
            "At the door, it checks the things you carry. Take the umbrella; it rains after five."]),
        dict(kind="html", params=dict(scene="kitchen"), tail=1.1, vo=[
            "In the kitchen, your daily vitamin D is waiting right on the box.",
            "And the fridge remembers the milk for the way back."]),
        dict(kind="html", params=dict(scene="desk"), tail=1.4, vo=[
            "At your desk, one look at the laptop: the report is due today.",
            "Pinch it done. No app to open, no phone to unlock."]),
        # 2. Brand + problem.
        dict(kind="card", args=dict(big="MEMAR", lines=["Memory + AR, for SPECS"]),
             vo=["This is MEMAR. Memory, plus AR: reminders that live on your things."]),
        dict(kind="card", args=dict(big="Reminder apps remember. They just don't remind you at the right moment.", kicker="The problem"),
             vo=["Reminder apps remember everything. They just don't remind you at the moment it matters."]),
        # 3. Use cases.
        dict(kind="html", params=dict(scene="usecases"), gap=0.35, tail=1.2, vo=[
            "So MEMAR puts each memory on the thing it belongs to, like a quiet assistant for your whole day.",
            "Daily routines, like vitamin D after lunch.",
            "Things you always forget, like the charger in your bag.",
            "Deadlines, right on your laptop.",
            "Errands, on the fridge.",
            "A quick check at the door before you leave.",
            "And you add them hands-free: look, pinch, or just say it."]),
        # 4. The real Lens in the Lens Studio SPECS preview.
        shot("s01_start.png", "Badges show what's waiting", "Each object carries its own count.", "The real Lens · SPECS preview",
             "Here's the real Lens, in the SPECS preview of Lens Studio. Every object shows a badge with how many things are waiting."),
        shot("s02_detect_keys.png", "Look to detect", "A short look locks on. A pinch confirms. (Simulated from head direction in the preview.)", "Look",
             "Look at something for a second and MEMAR locks on. Here it's simulated from head direction, and a pinch always confirms."),
        shot("s04_done_undo.png", "Pinch, Done, Undo", "Most urgent first. The badge drops, and Undo stays for 8 seconds.", "Recall",
             "Pinch to open its memories, most urgent first. Done drops the badge, and Undo stays for eight seconds."),
        shot("s08_listening.png", "Or just say it", "Presets or one sentence. Nothing saves until you pinch Save.", "Add",
             "Add from quick presets, or just say it. One sentence becomes a clean title, saved only when you pinch Save."),
        shot("s11_entryway.png", "Before you leave", "The front door lists what's pending on the things you carry.", "Entryway",
             "Turn to the entryway, and the door lists what's still pending on the things you carry."),
        shot("s14_routine_done.png", "Routines come back", "Tick off a daily routine and it returns tomorrow.", "Kitchen",
             "Tick off a daily routine, and it's back tomorrow by itself."),
        # 5. Live demo.
        sim_scene(),
        # 6. How it's built, honest status, end.
        dict(kind="card", args=dict(big="Built with CLAD and the Lens Studio MCP", kicker="How it's made",
                                    stats=[("14 / 14", "LEAF scenarios pass"), ("41", "engine tests pass"), ("10", "objects in 3 zones")]),
             vo=["MEMAR was built with CLAD and the Lens Studio MCP. All fourteen LEAF scenarios pass in the preview, and all forty one engine tests pass."]),
        dict(kind="card", args=dict(big="Today: stand-in objects in the preview.", kicker="What's next",
                                    lines=["Next: real recognition with a confirm step,", "and testing on SPECS hardware."]),
             vo=["Today the objects are stand-ins, because the preview can't see. Next comes real recognition, tested on SPECS."]),
        dict(kind="card", args=dict(big="MEMAR", lines=["Your real world. Your memories."]), tail=2.0,
             vo=["MEMAR. Your real world. Your memories."]),
    ]


def build_demo():
    scenes = []
    for i, sb in enumerate(demo_storyboard()):
        vos, dur = plan_vo(sb["vo"], lead=0.6 if sb["kind"] == "html" else 0.45, gap=sb.get("gap", 0.3),
                           tail=sb.get("tail", 1.35), min_dur=sb.get("min_dur", 0.0))
        key = f"demo_{i:02d}"
        if sb["kind"] == "html":
            p = dict(sb["params"], dur=dur, segs=[{"at": v["at"], "d": v["d"]} for v in vos],
                     captions=[{"text": v["text"], "start": v["at"], "end": v["at"] + v["d"]} for v in vos])
            clip = html_clip(key, p)
        else:
            cap = " ".join(v["text"] for v in vos)
            frame = frame_shot(caption=cap, **sb["args"]) if sb["kind"] == "shot" else frame_card(caption=cap, **sb["args"])
            clip = still_clip(frame, dur, key, zoom=0.03)
        scenes.append({"clip": clip, "dur": dur, "vos": vos})
        print(f"  scene {i:02d} {sb['kind']:5s} {dur:5.1f} s")
    out, total = assemble("demo", scenes, 0.5, energetic=False, music_db=-21)
    lines = [v for sc in scenes for v in sc["vos"]]
    with open(os.path.join(OUT, "MEMAR_Demo.srt"), "w", encoding="utf-8") as f:
        for i, v in enumerate(lines, 1):
            f.write(f"{i}\n{srt_time(v['start'])} --> {srt_time(v['start'] + v['d'])}\n{v['text']}\n\n")
    with open(os.path.join(OUT, "MEMAR_Demo_script.md"), "w", encoding="utf-8") as f:
        f.write("# MEMAR demo narration\n\nThe opening scenes are an illustrated concept mockup (labelled on screen); "
                "everything after the use-case montage is the real Lens or the real simulator.\n\n")
        for i, v in enumerate(lines, 1):
            f.write(f"{i}. [{srt_time(v['start'])}] {v['text']}\n")
    return out, total


# ── Intro teaser ──────────────────────────────────────────────────────────────────────────
INTRO = [
    dict(kind="html", params=dict(scene="door", segs=[{"at": 0.1, "d": 2.6}, {"at": 3.0, "d": 2.0}], captions=[]), dur=5.2),
    dict(kind="card", args=dict(big="MEMAR", lines=["Memory + AR, for SPECS"]), dur=3.2),
    dict(kind="shot", args=dict(shot="s01_start.png", title="Reminders that live on your things.", sub=None, intro=True), dur=3.2),
    dict(kind="shot", args=dict(shot="s02_detect_keys.png", title="Look. It notices.", sub=None, intro=True), dur=2.8),
    dict(kind="shot", args=dict(shot="s03_laptop_card.png", title="Pinch. It opens.", sub=None, intro=True), dur=2.8),
    dict(kind="shot", args=dict(shot="s04_done_undo.png", title="Done. With Undo.", sub=None, intro=True), dur=2.8),
    dict(kind="shot", args=dict(shot="s08_listening.png", title="Say it. Saved.", sub=None, intro=True), dur=2.8),
    dict(kind="shot", args=dict(shot="s11_entryway.png", title="Before you leave.", sub=None, intro=True), dur=2.8),
    dict(kind="shot", args=dict(shot="s14_routine_done.png", title="Routines that come back.", sub=None, intro=True), dur=2.8),
    dict(kind="shot", args=dict(shot="w01_phone.png", title="Try it on any phone.", sub=None, intro=True), dur=2.8),
    dict(kind="card", args=dict(big="MEMAR", lines=["Your real world. Your memories.", "Built for SPECS"]), dur=5.2,
         vo="MEMAR. Your real world. Your memories."),
]


def build_intro():
    scenes = []
    for i, sb in enumerate(INTRO):
        key = f"intro_{i:02d}"
        if sb["kind"] == "html":
            clip = html_clip(key, dict(sb["params"], dur=sb["dur"]))
        else:
            frame = frame_shot(**sb["args"]) if sb["kind"] == "shot" else frame_card(**sb["args"])
            clip = still_clip(frame, sb["dur"], key, zoom=0.05)
        sc = {"clip": clip, "dur": sb["dur"], "vos": []}
        if sb.get("vo"):
            p = vo_file(sb["vo"])
            sc["vos"] = [{"text": sb["vo"], "path": p, "at": 1.0, "d": probe_duration(p)}]
        scenes.append(sc)
    return assemble("intro", scenes, 0.35, energetic=True, music_db=-6)


if __name__ == "__main__":
    os.makedirs(BUILD, exist_ok=True)
    which = sys.argv[1] if len(sys.argv) > 1 else "both"
    if which in ("intro", "both"):
        p, t = build_intro()
        print(f"intro: {p} ({t:.1f} s)")
    if which in ("demo", "both"):
        p, t = build_demo()
        print(f"demo: {p} ({t:.1f} s)")
