# Agents

Specialized agents for the Aquilus Webapp project. Each agent has deep context about the codebase, follows project conventions, and maintains its own persistent memory.

Agent definitions live in `.claude/agents/`. Agent memories persist in `.claude/agent-memory/{agent-name}/`.

## When to Use Agents vs Superpowers Skills

**Superpowers skills** handle the _process_ — brainstorming, planning, TDD, debugging workflows, code review, git operations. They define _how_ to work.

**Custom agents** handle the _domain expertise_ — they know the codebase deeply and execute within a specific technical area. They define _what_ to build.

**Use together:** Superpowers skills orchestrate the workflow, dispatching custom agents for implementation tasks. For example:
- `superpowers:brainstorming` designs a feature → `superpowers:writing-plans` creates the plan → `superpowers:subagent-driven-development` dispatches `backend-engineer` or `database-architect` agents per task
- `superpowers:systematic-debugging` identifies a backend bug → `backend-engineer` agent fixes it
- `superpowers:test-driven-development` guides the TDD cycle → `backend-engineer` agent writes the tests and implementation

## Agent Registry

| Agent | Model | When to Use |
|-------|-------|-------------|
| `backend-engineer` | opus | FastAPI routes, services, repositories, Celery tasks, middleware, Python backend code |
| `database-architect` | sonnet | Schema design, migrations, query optimization, PostgreSQL, RLS/RBAC, indexing |
| `ai-engineer` | opus | LLM integration, RAG pipelines, vector databases, prompt engineering, Claude API |
| `react-native-engineer` | sonnet | React Native components, mobile UI, gestures, animations, navigation |
| `ui-designer` | sonnet | Visual design, layout, typography, color, component aesthetics, Tailwind |
| `code-cleanup-expert` | sonnet | Refactoring, dead code removal, modularity, test coverage, clean architecture |

## Agent Selection Guide

### Backend work
- **New endpoint, service, or business logic** → `backend-engineer`
- **Schema change, migration, query tuning** → `database-architect`
- **Both needed** → `database-architect` first (schema), then `backend-engineer` (code)

### Frontend work
- **Visual polish, layout, design decisions** → `ui-designer`
- **React Native mobile components** → `react-native-engineer`

### AI features
- **Claude API integration, embeddings, RAG** → `ai-engineer`

### Code quality
- **Refactoring, cleanup, test gaps** → `code-cleanup-expert`

### Multi-agent workflows
For complex features touching multiple layers:
1. `database-architect` — design schema + migration
2. `backend-engineer` — implement API layer
3. `ui-designer` — design the UI (if applicable)
4. `code-cleanup-expert` — review final implementation

## Dispatching Agents with Superpowers

When using `superpowers:subagent-driven-development`, dispatch the appropriate custom agent based on the task:

```
Task: "Add swimmer search endpoint"
→ Dispatch: backend-engineer agent

Task: "Add index for swimmer name lookups"
→ Dispatch: database-architect agent

Task: "Design the search results card"
→ Dispatch: ui-designer agent
```

## Agent Memory

Each agent maintains persistent memory in `.claude/agent-memory/{agent-name}/`:
- Discoveries about codebase patterns
- User preferences and feedback
- Project-specific context

Memory is project-scoped (shared via version control, not user-specific).
