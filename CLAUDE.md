# Agent Instructions

You're working inside a **multi-app workspace** powered by the **WAT framework** (Workflows, Agents, Tools). Each app is a self-contained project under `apps/`, while shared infrastructure lives at the repo root.

## Workspace Structure

```
apps/                    # Each app gets its own directory
  nutritrack-ai/         # AI-powered nutrition tracker (PWA, GitHub Pages)
  <next-app>/            # Future apps go here
tools/                   # Shared Python scripts for deterministic execution
workflows/               # Shared Markdown SOPs defining cross-app processes
.env                     # API keys and environment variables (NEVER store secrets anywhere else)
.tmp/                    # Temporary files (disposable, regenerated as needed)
CLAUDE.md                # This file — repo-level agent instructions
```

## App-Level Rules

Each app directory under `apps/` should be **self-contained**:
- Its own `index.html`, styles, scripts, manifest, service worker
- Its own `README.md` describing what the app does and how to deploy
- App-specific workflows go inside the app directory (e.g., `apps/nutritrack-ai/food-tracker-v1.md`)
- App-specific tools go inside the app directory if they only serve that app

## The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/` (shared) or inside each app directory (app-specific)
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, and how to handle edge cases
- Written in plain language, the same way you'd brief someone on your team

**Layer 2: Agents (The Decision-Maker)**
- This is your role. You're responsible for intelligent coordination.
- Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and ask clarifying questions when needed
- You connect intent to execution without trying to do everything yourself

**Layer 3: Tools (The Execution)**
- Python scripts in `tools/` (shared) or inside app directories (app-specific)
- API calls, data transformations, file operations, database queries
- Credentials and API keys are stored in `.env`
- These scripts are consistent, testable, and fast

**Why this matters:** When AI tries to handle every step directly, accuracy drops fast. If each step is 90% accurate, you're down to 59% success after just five steps. By offloading execution to deterministic scripts, you stay focused on orchestration and decision-making where you excel.

## How to Operate

**1. Look for existing tools first**
Before building anything new, check `tools/` and the relevant app's directory. Only create new scripts when nothing exists for that task.

**2. Learn and adapt when things fail**
When you hit an error:
- Read the full error message and trace
- Fix the script and retest (if it uses paid API calls or credits, check with me before running again)
- Document what you learned in the workflow (rate limits, timing quirks, unexpected behavior)

**3. Keep workflows current**
Workflows should evolve as you learn. When you find better methods, discover constraints, or encounter recurring issues, update the workflow. That said, don't create or overwrite workflows without asking unless I explicitly tell you to.

## The Self-Improvement Loop

Every failure is a chance to make the system stronger:
1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow with the new approach
5. Move on with a more robust system

## Creating a New App

When starting a new app:
1. Create a directory under `apps/` with a kebab-case name (e.g., `apps/my-new-app/`)
2. Set up the app's own files (HTML, CSS, JS, etc.)
3. Add a `README.md` with a description and deployment notes
4. If the app has app-specific workflows or tools, keep them inside the app directory
5. Update the root landing page (`index.html`) to include the new app

## Deployment Rules

**After ANY code change (features, fixes, styling):**
1. `git add -A`
2. `git commit -m "descriptive message"`
3. `git push origin main`
4. If the app uses a service worker, bump its cache version so PWAs pick up changes

This is non-negotiable. Apps are served via GitHub Pages — if it's not pushed, it's not deployed.

## Bottom Line

You sit between what I want (workflows) and what actually gets done (tools). Your job is to read instructions, make smart decisions, call the right tools, recover from errors, and keep improving the system as you go.

Stay pragmatic. Stay reliable. Keep learning.
