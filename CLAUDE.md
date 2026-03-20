# Aquilus Webapp

AI-powered swim performance analytics platform for competitive swim coaches. Provides data-driven insights, predictive modeling, FINA points tracking, and intelligent training optimization.

## Project Structure

```
aquilus-webapp/
├── frontend/          # React + TypeScript (Vite)
├── backend/           # FastAPI (Python)
├── worker/            # Celery background tasks + swim-scraper
├── jobs/              # Data scraping/sync scripts (gitignored)
├── terraform/         # Infrastructure (DigitalOcean)
├── nginx/             # Reverse proxy config
├── migrations/        # Database migrations (gitignored)
├── run.sh             # Local dev startup (backend + frontend)
├── run-all.sh         # Local dev startup (backend + frontend + Celery worker)
└── AGENTS.md          # Agent registry and usage guide
```

## Quick Start

```bash
./run.sh  # Starts backend (localhost:8000) + frontend (localhost:5173)
```

Backend requires a Python venv at `backend/.venv`. Frontend uses npm. Both need `.env` files (see `.env.sample` in each directory).

## Tech Stack

### Frontend (`frontend/`)
- **React 19** + **TypeScript 5.9** + **Vite 7**
- **Routing:** React Router DOM v7
- **State:** Zustand (stores in `src/stores/`) — use selectors via `src/hooks/useStores.ts` to prevent re-renders
- **Server state:** TanStack React Query (5min stale, 10min GC, 1 retry)
- **Styling:** Tailwind CSS v4 (utility classes, CSS variables for theming in `src/styles/index.css`)
- **Icons:** Lucide React
- **Charts:** Recharts, React Big Calendar
- **Auth:** Custom JWT via backend API (tokens stored in localStorage)
- **Analytics:** Mixpanel
- **Testing:** Vitest + React Testing Library (90% coverage target)

### Backend (`backend/`)
- **FastAPI** with Uvicorn
- **Database:** PostgreSQL via SQLAlchemy async — engine + sessions in `app/infrastructure/db.py`, models in `app/infrastructure/models.py`
- **Auth:** Self-issued JWT verification (`app/middleware/auth.py`), auth endpoints in `app/routes/auth.py`
- **Migrations:** Alembic (`backend/alembic/`)
- **Task queue:** Celery + Redis
- **AI:** Anthropic Claude SDK + ChromaDB (vector embeddings)
- **Web scraping:** DrissionPage (SwimRankings.net via `worker/swim-scraper/`)
- **Data:** Pandas, Pydantic v2

### Infrastructure
- **Hosting:** DigitalOcean droplet (Terraform)
- **Containers:** Docker Compose (frontend/nginx, backend, redis, worker)
- **HTTPS:** Nginx reverse proxy + Let's Encrypt

## Architecture

### Frontend Architecture (`frontend/src/`)

```
src/
├── components/       # Organized by feature (ai-coach/, calendar/, charts/, swimmer/, squad/, etc.)
├── pages/            # Route-level components (one per route)
├── stores/           # Zustand stores (authStore, squadStore, swimmerStore, uiStore, etc.)
├── hooks/            # Custom hooks + api/ subdirectory for API hooks
├── services/         # API call layer — all backend communication goes through these
├── contexts/         # AuthContext, ToastContext
├── providers/        # StoreProvider
├── lib/              # mixpanel.ts, apiClient.ts (axios instance with auth)
├── routes/           # ProtectedRoute, AdminRoute
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── styles/           # Global CSS + Tailwind theme variables
```

**Key patterns:**
- Pages are containers (data + state). Components are presenters (UI only).
- Services handle all API calls. Never call the backend directly from components.
- Zustand stores use devtools middleware. Access via selector hooks in `useStores.ts`.
- React Query handles caching/refetching. Services are called inside query functions.

### Backend Architecture (`backend/app/`)

```
app/
├── routes/           # FastAPI endpoint handlers (one file per domain)
│   └── swimmers/     # Modularized: core.py, performance.py, models.py, error_handlers.py
├── services/         # Business logic layer
│   └── prediction/   # Modularized prediction service (12 files)
├── repositories/     # Data access layer (base.py with generic CRUD)
├── models/           # Pydantic schemas (schemas.py, swimrankings.py)
├── domain/           # Exceptions, value objects
├── middleware/        # auth.py (JWT), logging_middleware.py
├── infrastructure/   # db.py (async engine + sessions), models.py (SQLAlchemy ORM), constants.py
├── utils/            # logger.py, log_error.py, fina_calculator.py
└── tasks/            # Celery task definitions
```

**Layered architecture:** Routes → Services → Repositories → Infrastructure

**Key patterns:**
- Auth via `Depends(get_current_user_id)` in route handlers
- Services accept optional repository instances (testability)
- Custom domain exceptions in `domain/exceptions.py` (NotFoundError, UnauthorizedError, ValidationError)
- Global exception handlers in `main.py` suppress internal details in production

## API

Base path: `/api/` (proxied by Nginx in production, direct in dev)

Auth: Bearer JWT token in `Authorization` header (self-issued by `/api/auth/login`)

Key endpoint groups: `/ai-coach/`, `/swimmers/`, `/squads/`, `/swimrankings/`, `/workouts/`, `/coaches/`, `/training-sessions/`, `/admin/`

API docs available at `http://localhost:8000/docs` (Swagger UI)

## Domain Concepts

- **Squads** — Training groups managed by coaches, containing swimmers and schedules
- **Swimmers** — Athletes with personal records, best times, historical performances, SwimRankings profiles
- **Workouts** — Training sets with structure, distance, effort level; can be AI-generated
- **Events** — Swim races (distances + strokes: 50m Free, 200m IM, etc.)
- **FINA Points** — International performance scoring system for comparing times across events
- **Predictions** — ML-driven forecasts for improvement potential and race outcomes
- **AI Coach** — Claude-powered workout generation using ChromaDB vector search

## Environment Variables

### Backend (`backend/.env`)
```
PORT, FRONTEND_URL, CHROMA_DB_PATH, ANTHROPIC_API_KEY
DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
```

### Frontend (`frontend/.env`)
```
VITE_ANTHROPIC_API_KEY, VITE_GROQ_KEY, VITE_API_URL, VITE_MIXPANEL_TOKEN
```

## Commands

### Frontend
```bash
cd frontend
npm run dev          # Dev server with HMR
npm run build        # Production build (tsc + vite)
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
npm run test:coverage # Coverage report
```

### Backend
```bash
cd backend
source .venv/bin/activate  # or .venv/Scripts/activate on Windows
uvicorn app.main:app --reload --port 8000
pytest                     # Run tests
```

### Docker (Production)
```bash
docker compose up --build    # All services
docker compose up -d         # Detached mode
```

## Coding Conventions

### Frontend
- **Components:** PascalCase files (`SwimmerCard.tsx`), named exports preferred
- **Hooks:** `use` prefix, camelCase (`useSquadMetrics.ts`)
- **Services:** camelCase (`swimmerService.ts`)
- **Stores:** camelCase (`authStore.ts`)
- **Types:** Defined in `types/` directory or co-located with components via interfaces
- **Path alias:** `@/` maps to `src/` (configured in tsconfig + vite)
- Use functional components with hooks, no class components
- Tailwind utility classes for all styling, no separate CSS files per component
- All routes wrap pages in `<GlobalLayout>` (see App.tsx pattern)

### Backend
- **Routes:** plural nouns (`swimmers.py`, `squads.py`)
- **Services:** singular noun + `_service.py` (`squad_service.py`)
- **Repositories:** entity name + repo pattern (`base.py` has generic CRUD)
- Route handlers use `async def` with type-annotated params
- Services are instantiated per-request in route handlers
- Use structured logging via `app.utils.logger`
- Keep error messages generic in production (DEBUG env var controls detail)

## Testing

- Frontend tests live in `__tests__/` directories next to source files
- Backend tests in `backend/tests/`
- Mock external services (apiClient, Anthropic) in tests
- Frontend coverage target: 90% (lines, functions, branches, statements)

## Known Patterns & Gotchas

- The `experiments/` and `jobs/` directories are gitignored — R&D and scraping code
- `migrations/` is also gitignored
- The prediction service is heavily modularized (12 files in `services/prediction/`)
- Tools live under `/tools/*` — AI Coach at `/tools/ai-coach`, Comparison at `/tools/comparison`, Standards at `/tools/standards`. Legacy paths (`/ai-coach`, `/comparison`, `/time-standards`) redirect to `/tools/*` equivalents.
- SwimRankings integration uses DrissionPage (Chromium automation) to bypass Cloudflare Turnstile — see `worker/swim-scraper/`
- Celery worker has memory limits (1GB max, 512MB reserved) — see docker-compose.yml
- Frontend has both `lib/apiClient.ts` (axios) and `lib/api.ts` — prefer `apiClient.ts`
- Admin access is a hardcoded email check (`is_admin` flag or email string comparison in the auth middleware/admin routes), not a database role — there is no admin role table

## Agents

See `AGENTS.md` for full agent documentation.

6 specialized agents in `.claude/agents/`:
- **backend-engineer** (opus) — FastAPI, services, Celery tasks, Python backend
- **database-architect** (sonnet) — schema, migrations, queries, PostgreSQL, RLS
- **ai-engineer** (opus) — LLM integration, RAG, Claude API, vector search
- **react-native-engineer** (sonnet) — React Native mobile components
- **ui-designer** (sonnet) — visual design, layout, Tailwind, aesthetics
- **code-cleanup-expert** (sonnet) — refactoring, dead code, test coverage

Agents work with superpowers skills: skills handle process (brainstorming, planning, TDD, debugging), agents handle domain expertise (implementation). When adding new agents, update both `AGENTS.md` and this section.
