# TaskFlow — AI-Powered Task Management

A full-stack task management web app with a built-in **multi-agent AI system (Agent Lab)**, real-time SSE streaming, and a Playwright-based browser agent runtime.

---

## What's Inside

| Part | Description |
|---|---|
| `artifacts/taskflow` | React + Vite frontend — Task List UI + Agent Lab |
| `artifacts/api-server` | Express backend — REST API + multi-agent pipeline |
| `lib/db` | Drizzle ORM + Supabase PostgreSQL schema |
| `lib/api-spec` | OpenAPI spec (source of truth for the API) |
| `lib/api-zod` | Auto-generated Zod validators |
| `lib/api-client-react` | Auto-generated React query hooks |
| `lib/integrations-openai-ai-server` | OpenAI SDK wrapper (Replit AI proxy) |
| `tools/browser-agent` | Standalone Playwright browser agent runtime |

---

## Quick Start

### On Replit

Just open the project — both services start automatically.

### Locally (VS Code or any terminal)

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
#    Then open .env and fill in at minimum:
#      SUPABASE_DATABASE_URL   ← your Supabase connection string
#      AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY
#      (or use Ollama — see comments inside .env.example)

# 3. Push database schema
pnpm --filter @workspace/db run push

# 4. Start the backend on :8080 (in one terminal)
pnpm --filter @workspace/api-server run dev

# 5. Start the frontend on :3000 (in another terminal)
pnpm --filter @workspace/taskflow run dev
```

The Vite dev server automatically proxies `/api` requests to `http://localhost:8080`, so no CORS or port wiring is needed.

---

## App Features

### Task Management (`/`)
- Create, edit, delete tasks
- Mark tasks complete / in progress / done
- Filter by status and priority
- Dashboard with stats: total, completed, overdue, priority breakdown

### Agent Lab (`/agent`)
- Type a goal (e.g. "Build a login system")
- 5 AI agents run in sequence: **Planner → Architect → Coder → Security → Reviewer**
- Real-time log stream via SSE (Server-Sent Events)
- Pipeline progress stepper
- Start / stop controls
- Recent runs history

---

## Multi-Agent Pipeline

Agents run in order with **smart conditional routing**:

```
Planner → Architect → Coder → Security → Reviewer → Done
                          ↑        |           |
                          └── UNSAFE           |
                          ↑                    |
                          └──── NEEDS_IMPROVEMENT
```

- If **Security** rates the code `UNSAFE` → routes back to **Coder**
- If **Reviewer** rates the code `NEEDS_IMPROVEMENT` → routes back to **Coder**
- Loop protection: max 10 iterations per step before aborting
- All transitions logged live to the Agent Lab UI

Implemented in:
- `artifacts/api-server/src/services/pipelineController.js` — pure JS workflow engine
- `artifacts/api-server/src/services/agentOrchestrator.ts` — OpenAI + SSE integration

---

## Database

Uses **Supabase PostgreSQL** via the session pooler (HTTPS-compatible, works on Replit).

```
Host: aws-1-ap-southeast-2.pooler.supabase.com
Port: 5432 (session pooler)
```

Connection string is stored in the `SUPABASE_DATABASE_URL` environment secret.

Schema is managed by Drizzle ORM. To apply changes:
```bash
pnpm --filter @workspace/db run push
```

### `tasks` table

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `title` | text | Required |
| `description` | text | Optional |
| `status` | text | `todo` / `in_progress` / `done` |
| `priority` | text | `low` / `medium` / `high` |
| `due_date` | text | ISO date string |
| `user_id` | text | Clerk user ID |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto |

---

## API Endpoints

All under `/api`:

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | No | Health check (DB + agents status) |
| GET | `/tasks` | Yes | List tasks |
| POST | `/tasks` | Yes | Create a task |
| GET | `/tasks/stats` | Yes | Dashboard stats |
| GET | `/tasks/:id` | Yes | Get a task |
| PATCH | `/tasks/:id` | Yes | Update a task |
| DELETE | `/tasks/:id` | Yes | Delete a task |
| PATCH | `/tasks/:id/toggle` | Yes | Toggle status |
| POST | `/agents/runs` | No | Start an agent run |
| GET | `/agents/runs` | No | List recent runs |
| GET | `/agents/runs/:id` | No | Get run details |
| DELETE | `/agents/runs/:id/stop` | No | Stop a run |
| GET | `/agents/runs/:id/stream` | No | SSE log stream |

---

## Browser Agent (`tools/browser-agent`)

A standalone Playwright-based browser agent that controls a browser **without screenshots** — uses the DOM + accessibility tree instead.

```
Playwright reads DOM/a11y tree → LLM decides action → Playwright executes → repeat
```

### Setup (run locally — requires Chrome system libraries)

```bash
cd tools/browser-agent
npm install
npx playwright install chromium
```

### Run

```bash
node index.js

# Custom target
TARGET_URL="https://github.com/login" USER_GOAL="login with email" node index.js
```

### File Structure

```
tools/browser-agent/
  index.js       — main loop (max 10 steps)
  browser.js     — launches headless Chromium
  extractor.js   — reads DOM + accessibility tree
  normalizer.js  — converts to clean JSON (buttons, inputs, links)
  agent.js       — mock LLM decision layer (swap in OpenAI here)
  executor.js    — safely executes click / type / scroll actions
```

To plug in a real LLM, replace `llmDecide()` in `agent.js` with an OpenAI API call.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SUPABASE_DATABASE_URL` | — | Supabase PostgreSQL connection string |
| `DATABASE_URL` | — | Fallback DB (used if Supabase not set) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | — | LLM API base URL (OpenAI / Groq / Ollama) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | — | API key (`ollama` for local Ollama) |
| `OPENAI_MODEL` | `gpt-4o` | Model to use (e.g. `llama3`, `llama3-70b-8192`) |
| `PORT` | `8080` | Port for the api-server |
| `API_PORT` | `8080` | Port Vite proxies `/api` to (frontend only) |
| `BASE_PATH` | `/` | URL prefix (e.g. `/taskflow` on Replit) |
| `VITE_CLERK_PUBLISHABLE_KEY` | — | Clerk auth — app works without it |
| `CLERK_SECRET_KEY` | — | Clerk server-side key |

Copy `.env.example` to `.env` at the workspace root and fill in your values.  
The api-server loads `.env` automatically via `--env-file-if-exists` at startup.

---

## Project Commands

```bash
pnpm install                                      # install all deps
pnpm run typecheck                                # typecheck all packages
pnpm run build                                    # typecheck + build all
pnpm --filter @workspace/db run push              # push schema to Supabase
pnpm --filter @workspace/api-spec run codegen     # regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-server run dev       # start backend
pnpm --filter @workspace/taskflow run dev         # start frontend
```

---

## Tech Stack

- **Runtime**: Node.js 24, pnpm workspaces
- **Frontend**: React 19, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express 5, TypeScript, esbuild
- **Database**: Supabase PostgreSQL, Drizzle ORM
- **AI**: OpenAI GPT (via Replit AI proxy), SSE streaming
- **Auth**: Clerk (optional)
- **Browser automation**: Playwright (tools/browser-agent)
- **Pipeline**: Custom JS workflow engine with conditional transitions + loop protection
