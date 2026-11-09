# MEMAR setup guide (laptop, step by step)

Order matters. Lens Studio must be open **before** you start the coding agent, because Lens Studio creates the MCP server the agent connects to.

## 1. Install the tools (~30 min)

| Tool | Where | Check |
|---|---|---|
| **Lens Studio 5.22 or newer** (latest is best; past entries used 5.24.1) | https://ar.snap.com → Download. Log in with your Snapchat account | Opens and shows the Home screen |
| **Node.js LTS** | https://nodejs.org | `node -v` and `npx -v` work |
| **Git** | https://git-scm.com | `git --version` |
| **Claude Code CLI** (recommended agent; Codex or Cursor also work) | macOS/Linux: `curl -fsSL https://claude.ai/install.sh \| bash` · Windows PowerShell: see https://claude.com/product/claude-code | `claude --version` |
| **GitHub account** | https://github.com | You'll publish the repo here |
| **OBS Studio** or built-in screen recorder | https://obsproject.com (or Win+G / Cmd+Shift+5) | For the demo video |

Note: Claude Code means the **terminal CLI**, not the Claude desktop app.

## 2. Create the SPECS project

1. Open Lens Studio.
2. On the Home screen choose **SPECS**, then **Base Template**.
3. **File → Save As**, name it `MEMAR`, save somewhere simple, e.g. `C:\Users\<you>\Projects` (not under Downloads). Lens Studio creates a folder `MEMAR` containing `MEMAR.esproj` and `.mcp.json`.
4. Press **Preview** once to confirm the empty template runs. In Interactive Preview: WASD moves, Q/E down/up, right-drag looks around, a click is a pinch.
5. **Keep Lens Studio open** with this project for everything that follows.

## 3. Start Claude Code in the project folder

```bash
cd ~/Projects/MEMAR        # the folder that contains MEMAR.esproj
claude
```

If Claude asks about the project's MCP server, choose **"Use this and all future MCP servers in this project"**. Then check:

```
/mcp
```

You should see `lens-studio` connected. If not: in Lens Studio's menu go to **AI Assistant → AI Model Context Protocol (MCP) → Configure Server**, make sure it's running, then restart `claude` in the same folder. Troubleshooting: https://developers.specs.com/docs/clad/troubleshooting/troubleshoot-lens-studio-mcp

## 4. Install CLAD (inside Claude Code)

```
/plugin marketplace add https://github.com/lens-studio-devs/ls-extensions.git
/plugin install ls-clad@ls-extensions
/reload-plugins
```

Check with `/plugin`: `ls-clad` should be listed. Official guide: https://developers.specs.com/docs/clad/setup/setup-ai/claude-code-setup

## 5. Install the Devpost Learn skill pack

Exit Claude Code (or open a second terminal in the same folder) and run:

```bash
npx skills add challengepost/learn-specs --all -y
```

Restart `claude` in the folder.

## 6. Run plan-lens (~25 min)

In Claude Code type:

```
plan-lens
```

Answer each question in your own words. Use `docs/PLAN_LENS_PREP.md` (from this kit) as your notes, but **don't paste it in**: the skill is designed to interview you, and the brief should reflect your decisions. When it shows the draft brief, ask for changes, then say "looks good" to approve it. It saves `devpost/design-brief.md`.

## 7. Copy the MEMAR kit into the project

Do this **after** plan-lens and **before** the build. From the kit folder, copy into your project folder:

| From the kit | To your project |
|---|---|
| `Assets/Scripts/Memora/` (6 `.ts` files) | `MEMAR/Assets/Scripts/Memora/` |
| `tests/`, `package.json` | `MEMAR/` (project root) |
| `docs/` | `MEMAR/docs/` |
| `README.md` | `MEMAR/README.md` (replace the template's if it has one) |
| `.gitignore` | merge its lines into `MEMAR/.gitignore` (create it if missing) |

Lens Studio watches the `Assets` folder and imports new files on its own. Check that the six scripts appear in the **Asset Browser** under `Scripts/Memora` and that the **Logger** panel shows no TypeScript errors. If they don't show up, drag the `Memora` folder into the Asset Browser.

Optional: run the engine tests (needs `typescript`: `npm i -g typescript` once):

```bash
cd ~/Projects/MEMAR && npm test
```

Expect `pass 17`, `fail 0`. (`npm test` fetches the TypeScript compiler with npx the first time, so it needs internet once.)

## 8. Build with CLAD

Clear the chat (`/clear`) so CLAD starts clean, then follow `03_CLAD_PROMPTS.md`, prompt 1.

## 9. Publish the repo

```bash
cd ~/Projects/MEMAR
git init
git add .
git status          # make sure .mcp.json, Cache/, Workspaces/ are NOT listed
git commit -m "MEMAR: object-linked memories for SPECS"
git branch -M main
git remote add origin https://github.com/<you>/memora-specs.git
git push -u origin main
```

Create the empty repo on GitHub first (public, no README). **Never commit `.mcp.json`**: it can hold a local access token.

## If something breaks

| Symptom | Fix |
|---|---|
| `/mcp` doesn't show lens-studio | Lens Studio must be open with this project; restart `claude` from the folder with the `.esproj` |
| `/plugin` doesn't list ls-clad | Re-run the marketplace + install commands, then `/reload-plugins`. https://developers.specs.com/docs/clad/troubleshooting/troubleshoot-lens-studio-plugin |
| plan-lens says no `.esproj` | You started `claude` in the wrong folder |
| Lens Studio asks to allow LEAF / Icon Atlas plugins | Allow them, so the project compiles |
| TypeScript errors in `Scripts/Memora` | Paste the Logger error to CLAD: "Fix this compile error without changing MemoraStore's behaviour" |
| Preview runs but the scene is empty | Ask CLAD: "Preview shows nothing in front of the camera. Check the desk is placed ~70 cm in front of the user at start and re-verify in Preview" |
