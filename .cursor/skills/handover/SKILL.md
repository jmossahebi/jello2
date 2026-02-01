---
name: handover
description: Summarizes recent project changes and key context for LLM or human handover. Use when the user asks for a handover, project summary, latest changes, context for another agent, or what has been done recently.
---

# Project Handover

Produce a handover document so another LLM or developer can pick up the project without re-reading the whole codebase.

## What to include

1. **Recent changes**
   - Inspect git history (e.g. `git log`, `git diff`, or `git status`).
   - Summarize recent commits and notable file changes.
   - Call out any in-progress or unfinished work (uncommitted changes, TODOs, failing tests) if visible.

2. **Project context**
   - **What it is**: One-line description (from README or code).
   - **Stack and key tools**: Languages, frameworks, databases, APIs, deployment (e.g. from `package.json`, `requirements.txt`, config files).
   - **Structure**: Main entrypoints, important directories, and where core logic lives.
   - **How to run**: From README or obvious scripts (e.g. `npm run dev`, `python main.py`).
   - **Config and secrets**: Where env/config lives (e.g. `.env.example`, `firebase-config.js`), and what must be set—without pasting secrets.

3. **Useful pointers**
   - Open issues, known quirks, or "start here" files if you've seen them.
   - One or two file paths that are most important to read first.

## Output format

Produce a single handover section the user can copy or save. Use this structure:

````markdown
# Handover – [Project name]

**Generated:** [Date]

## Recent changes
- [Bullet summary of recent commits and file changes]
- [Any uncommitted work or TODOs]

## Project summary
- **Purpose:** [One line]
- **Stack:** [Languages, frameworks, DB, deployment]
- **Key paths:** [Entrypoints and important dirs]
- **Run:** [How to run / dev server]
- **Config:** [Where and what to configure]

## Next steps / pointers
- [What to look at first or known gotchas]
````

## Process

1. Run or inspect git (log, diff, status) to capture recent changes.
2. Read README, root config, and key files to fill project summary and run instructions.
3. Compose the handover using the template above.
4. Prefer brevity; link to files or docs instead of pasting long content.
