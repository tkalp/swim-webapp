# AI Coach SP3: Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI Coach page with a chat-based interface featuring persistent conversation history, structured kickoff, inline section editing, quick actions, and one-click workout save.

**Architecture:** Two phases — Phase A builds the backend conversation API (2 new DB tables, 5 endpoints, conversation-aware Claude calls). Phase B builds the frontend (8 new React components, page rewrite, service/hook rewrite). The frontend consumes the Phase A API.

**Tech Stack:** Backend: FastAPI, SQLAlchemy async, Alembic, Claude Sonnet. Frontend: React 19, TypeScript 5.9, Tailwind CSS v4, Zustand, React Query, Lucide React.

**Spec:** `docs/superpowers/specs/2026-03-19-ai-coach-sp3-frontend-redesign.md`

**Agent mapping:**
- Tasks 1-4 (backend): `database-architect` + `backend-engineer`
- Tasks 5-12 (frontend): `react-native-engineer` + `ui-designer`
- Task 6 (AI prompt integration): `ai-engineer`

---

## File Structure

### Phase A: Backend (new files)
| File | Responsibility |
|------|---------------|
| `backend/alembic/versions/xxxx_add_ai_coach_conversations.py` | Migration: 2 new tables + indexes |
| `backend/app/infrastructure/models.py` | Add `AICoachConversation` + `AICoachMessage` ORM models |
| `backend/app/services/conversation_service.py` | Conversation CRUD + message handling |
| `backend/app/routes/ai_coach_conversations.py` | 5 new conversation endpoints |

### Phase A: Backend (modified files)
| File | Changes |
|------|---------|
| `backend/app/services/ai_coach/workout_generator.py` | Add `generate_workout_with_history()` that accepts conversation messages |
| `backend/app/services/ai_coach/client.py` | Add `generate_with_claude_messages()` using multi-turn messages API |
| `backend/app/main.py` | Register conversations router |

### Phase B: Frontend (new files)
| File | Responsibility |
|------|---------------|
| `frontend/src/types/ai-coach/types.ts` | Rewrite: Conversation, Message, WorkoutSections, KickoffParams |
| `frontend/src/utils/parseWorkoutSections.ts` | Pure utility: parse workout text into sections |
| `frontend/src/services/aiCoachService.ts` | Rewrite: add conversation CRUD endpoints |
| `frontend/src/hooks/useAICoach.ts` | Rewrite: conversation state + React Query |
| `frontend/src/components/ai-coach/ChatInput.tsx` | Bottom input bar |
| `frontend/src/components/ai-coach/WorkoutSection.tsx` | Single editable section |
| `frontend/src/components/ai-coach/WorkoutCard.tsx` | AI response card with sections + actions |
| `frontend/src/components/ai-coach/QuickActions.tsx` | Action button row |
| `frontend/src/components/ai-coach/ChatMessage.tsx` | Message renderer (coach bubble or WorkoutCard) |
| `frontend/src/components/ai-coach/ChatThread.tsx` | Scrollable message list |
| `frontend/src/components/ai-coach/KickoffForm.tsx` | Optional structured form |
| `frontend/src/components/ai-coach/ConversationSidebar.tsx` | Sidebar with history |
| `frontend/src/pages/AICoachPage.tsx` | Complete rewrite: three-panel layout |

### Phase B: Frontend (removed files)
- `frontend/src/components/ai-coach/BestTimesInput.tsx`
- `frontend/src/components/ai-coach/TemplateSelector.tsx`
- `frontend/src/components/ai-coach/PromptTips.tsx`
- `frontend/src/components/ai-coach/WorkoutOutput.tsx`

---

## PHASE A: BACKEND

### Task 1: Database migration — conversation tables

**Agent:** `database-architect`

**Files:**
- Modify: `backend/app/infrastructure/models.py`
- Create: `backend/alembic/versions/xxxx_add_ai_coach_conversations.py`

- [ ] **Step 1: Add ORM models to models.py**

Add after the WorkoutSessionFeedback class (~line 387):

```python
# ──────────────────────────────────────────────
# AI Coach Conversations
# ──────────────────────────────────────────────

class AICoachConversation(Base):
    __tablename__ = "ai_coach_conversations"
    __table_args__ = (
        Index("ix_ai_coach_conversations_coach_id", "coach_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    coach_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coach.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    coach: Mapped["Coach"] = relationship()
    messages: Mapped[List["AICoachMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="AICoachMessage.created_at")


class AICoachMessage(Base):
    __tablename__ = "ai_coach_messages"
    __table_args__ = (
        Index("ix_ai_coach_messages_conversation_id", "conversation_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_coach_conversations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "coach" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["AICoachConversation"] = relationship(back_populates="messages")
```

- [ ] **Step 2: Create Alembic migration**

Migration adds both tables with indexes. `down_revision` = current head (check with `alembic heads`).

- [ ] **Step 3: Run migration**

```bash
cd backend && alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp3): add ai_coach_conversations + ai_coach_messages tables"
```

---

### Task 2: Conversation service

**Agent:** `backend-engineer`

**Files:**
- Create: `backend/app/services/conversation_service.py`

- [ ] **Step 1: Implement service**

Functions needed:

```python
async def list_conversations(db, coach_id, limit=20) -> list[dict]
async def create_conversation(db, coach_id, title=None) -> dict
async def get_conversation_with_messages(db, coach_id, conversation_id) -> dict
async def delete_conversation(db, coach_id, conversation_id) -> None
async def add_message(db, conversation_id, role, content, metadata=None) -> dict
async def update_conversation_title(db, conversation_id, title) -> None
async def update_conversation_timestamp(db, conversation_id) -> None
```

Key details:
- `list_conversations` returns `[{id, title, created_at, updated_at, message_count}]` with a subquery for count
- `get_conversation_with_messages` verifies `coach_id` matches (ownership check), eagerly loads messages
- `delete_conversation` verifies ownership before deleting
- All functions use async SQLAlchemy sessions

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(sp3): add conversation service — CRUD + message handling"
```

---

### Task 3: Conversation-aware workout generation

**Agent:** `ai-engineer`

**Files:**
- Modify: `backend/app/services/ai_coach/workout_generator.py`
- Modify: `backend/app/services/ai_coach/client.py`

- [ ] **Step 1: Add multi-turn generation to client.py**

Add a new function `generate_with_claude_messages()` that uses Claude's multi-turn messages API:

```python
def generate_with_claude_messages(
    conversation_messages: list[dict],  # [{role: "user"|"assistant", content: str}]
    system_context: str,  # system prompt + style + examples
) -> str:
```

This passes the full conversation history to Claude as proper multi-turn messages, with the system prompt + coach style + global examples in the `system` parameter.

- [ ] **Step 2: Add `generate_workout_with_history()` to workout_generator.py**

```python
async def generate_workout_with_history(
    conversation_messages: list[dict],
    coach_id: str | None = None,
    db=None,
) -> str:
```

Flow:
1. Extract the latest user message for metadata filter
2. Stage 1: ChromaDB search (metadata-filtered)
3. Stage 2: Coach style + examples from PostgreSQL
4. Build system context string (style + coach examples + global examples)
5. Call `generate_with_claude_messages(conversation_messages, system_context)`
6. Return the workout text

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sp3): add conversation-aware workout generation with multi-turn Claude API"
```

---

### Task 4: Conversation API routes

**Agent:** `backend-engineer`

**Files:**
- Create: `backend/app/routes/ai_coach_conversations.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Implement routes**

5 endpoints under `APIRouter(prefix="/ai-coach/conversations", tags=["AI Coach Conversations"])`:

```python
GET  ""                    # list_conversations (last 20)
POST ""                    # create_conversation
GET  "/{conversation_id}"  # get_conversation_with_messages
DELETE "/{conversation_id}" # delete_conversation
POST "/{conversation_id}/messages"  # send message + get AI response
```

The `POST /{conversation_id}/messages` endpoint is the main one:
1. Resolve coach from user_id
2. Verify conversation ownership
3. Save coach message via `add_message()`
4. Load all conversation messages
5. Call `generate_workout_with_history(messages, coach_id, db)`
6. Save AI response via `add_message()`
7. Auto-generate title from first coach message (first 50 chars) if conversation has no title
8. Update conversation `updated_at`
9. Return `{coach_message, assistant_message}`

- [ ] **Step 2: Register router in main.py**

- [ ] **Step 3: Test endpoints manually**

```bash
# List conversations
curl http://localhost:8000/ai-coach/conversations -H "Authorization: Bearer <token>"

# Create conversation
curl -X POST http://localhost:8000/ai-coach/conversations -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{}'

# Send message (replace {id} with conversation ID)
curl -X POST http://localhost:8000/ai-coach/conversations/{id}/messages -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"content": "3000m sprint workout for seniors"}'
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp3): add conversation API — list, create, get, delete, send message"
```

---

## PHASE B: FRONTEND

### Task 5: TypeScript types + workout section parser

**Agent:** `react-native-engineer`

**Files:**
- Rewrite: `frontend/src/types/ai-coach/types.ts`
- Create: `frontend/src/utils/parseWorkoutSections.ts`

- [ ] **Step 1: Rewrite types**

```typescript
export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'coach' | 'assistant';
  content: string;
  metadata: MessageMetadata | null;
  created_at: string;
}

export interface MessageMetadata {
  kickoff_params?: KickoffParams;
  sections?: WorkoutSections;
  edited_sections?: WorkoutSections;
  saved_workout_id?: string;
  saved_workout_title?: string;
}

export interface KickoffParams {
  training_focus?: string;
  target_distance?: number;
  level?: string;
  stroke_emphasis?: string;
}

export interface WorkoutSections {
  warmup?: string;
  preset?: string;
  main?: string;
  cooldown?: string;
  raw?: string; // fallback if parsing fails
}
```

- [ ] **Step 2: Implement section parser utility**

Create `frontend/src/utils/parseWorkoutSections.ts`:

```typescript
export function parseWorkoutSections(text: string): WorkoutSections {
  // Split by section headers: Warm-up/Warmup/WU, Pre-set, Main set/Main, Cool-down/Cooldown/CD
  // If parsing fails, return { raw: text }
}
```

Use regex to find section boundaries. Handle edge cases (no headers found → return `{raw: text}`).

- [ ] **Step 3: Write tests for parser**

```bash
cd frontend && npm run test -- --run parseWorkoutSections
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp3): add conversation types + workout section parser utility"
```

---

### Task 6: API service layer

**Agent:** `react-native-engineer`

**Files:**
- Rewrite: `frontend/src/services/aiCoachService.ts`

- [ ] **Step 1: Add conversation API functions**

Keep existing `generateWorkout`, `generateWorkoutDescription`, `generateWorkoutTitle` for backward compatibility. Add:

```typescript
export async function listConversations(): Promise<Conversation[]>
export async function createConversation(title?: string): Promise<Conversation>
export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }>
export async function deleteConversation(id: string): Promise<void>
export async function sendMessage(conversationId: string, content: string, metadata?: object): Promise<{ coach_message: Message; assistant_message: Message }>
```

All use `authenticatedFetch` from `@/lib/apiClient` (existing pattern).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(sp3): add conversation API service functions"
```

---

### Task 7: useAICoach hook rewrite

**Agent:** `react-native-engineer`

**Files:**
- Rewrite: `frontend/src/hooks/useAICoach.ts`

- [ ] **Step 1: Rewrite hook**

State:
- `conversations` — React Query for sidebar list
- `activeConversationId` — currently selected
- `messages` — loaded on conversation select
- `isGenerating` — loading state

Actions:
- `createConversation()` → POST, set as active
- `selectConversation(id)` → GET messages, set as active
- `sendMessage(content, metadata?)` → POST /messages, append to local state optimistically
- `deleteConversation(id)` → DELETE, remove from list
- `startNewChat()` → clear active conversation, show kickoff
- `saveWorkout(messageContent)` → call existing workout create API + title/description generators

Use React Query `useQuery` for conversation list, `useMutation` for create/send/delete.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(sp3): rewrite useAICoach hook with conversation state + React Query"
```

---

### Task 8: Atomic UI components (ChatInput, WorkoutSection, QuickActions)

**Agent:** `react-native-engineer`

**Files:**
- Create: `frontend/src/components/ai-coach/ChatInput.tsx`
- Create: `frontend/src/components/ai-coach/WorkoutSection.tsx`
- Create: `frontend/src/components/ai-coach/QuickActions.tsx`

- [ ] **Step 1: ChatInput**

Textarea + send button. Enter sends, Shift+Enter newline. Disabled during generation. Dark theme styling per spec.

- [ ] **Step 2: WorkoutSection**

Single workout section with always-visible edit icon. Click to edit → auto-sizing textarea + Done/Cancel buttons. `aria-label="Edit [section name]"`.

- [ ] **Step 3: QuickActions**

Two-tier button row: primary (Make Harder, Make Easier) + secondary chips (Add Kick, Add Drill, Shorten, Lengthen). Grouped with subtle separators. Calls `onAction(type)` callback.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(sp3): add ChatInput, WorkoutSection, QuickActions components"
```

---

### Task 9: WorkoutCard + ChatMessage

**Agent:** `react-native-engineer`

**Files:**
- Create: `frontend/src/components/ai-coach/WorkoutCard.tsx`
- Create: `frontend/src/components/ai-coach/ChatMessage.tsx`

- [ ] **Step 1: WorkoutCard**

- Receives parsed `WorkoutSections` + `isLatest` flag + `savedWorkout` info
- Renders sections via `WorkoutSection` with section headers (`text-xs font-semibold text-cyan-400 uppercase tracking-wide`)
- If `isLatest`: shows QuickActions + Save button (gradient CTA)
- If not latest but saved: shows "Saved as [title]" link
- Save button: calls `onSave()`, shows success state after save
- Visually separated action footer: `mt-4 pt-4 border-t border-slate-800`

- [ ] **Step 2: ChatMessage**

- If `role === 'coach'`: render left-aligned coach bubble with cyan left-border accent
- If `role === 'assistant'`: delegate to `WorkoutCard`
- Passes `isLatest` prop (true only for the last assistant message)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sp3): add WorkoutCard + ChatMessage components"
```

---

### Task 10: ChatThread + KickoffForm

**Agent:** `react-native-engineer`

**Files:**
- Create: `frontend/src/components/ai-coach/ChatThread.tsx`
- Create: `frontend/src/components/ai-coach/KickoffForm.tsx`

- [ ] **Step 1: ChatThread**

- Scrollable container (`overflow-y-auto`) mapping messages to `ChatMessage`
- Auto-scroll to bottom on new messages (`useRef` + `scrollIntoView`)
- `aria-live="polite"` for screen reader announcement
- Loading indicator (reuse wave animation) when generating
- Empty state when no messages: "Start your first AI coaching session"

- [ ] **Step 2: KickoffForm**

- Large free-text input as primary entry point (centered in empty chat)
- "Add more context" expandable section reveals:
  - Training Focus: button group (`role="radiogroup"`) — Sprint, Endurance, Technique, IM, Kick, Recovery, Race Prep
  - Target Distance: native `<select>` — 1500m–6000m
  - Level: button group — Age Group, Senior, Masters
  - Stroke Emphasis: button group — Freestyle, Backstroke, Breaststroke, Butterfly, IM, Mixed
- All structured fields optional
- On submit: combines selections + free text into natural prompt, calls `onSubmit(prompt, metadata)`
- Button groups: unselected `border-slate-700 text-slate-400`, selected `bg-cyan-500/10 border-cyan-500/20 text-cyan-400`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(sp3): add ChatThread + KickoffForm components"
```

---

### Task 11: ConversationSidebar

**Agent:** `react-native-engineer`

**Files:**
- Create: `frontend/src/components/ai-coach/ConversationSidebar.tsx`

- [ ] **Step 1: Implement sidebar**

- Desktop: `w-64 bg-slate-900 border-r border-slate-800 h-full overflow-y-auto`
- "New Chat" button at top (prominent, full width)
- Conversation list: sorted by `updated_at DESC`, max 20
- Each item: title (truncated), relative time, delete icon button
- Active conversation: `bg-slate-800` highlight
- Delete: confirmation dialog before removing
- Mobile: overlay drawer (slides from left with `bg-black/50` backdrop)
- Drawer auto-closes on conversation select
- Mobile trigger: history icon button in page header

Props: `conversations, activeId, onSelect, onNew, onDelete, isOpen (mobile), onClose (mobile)`

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(sp3): add ConversationSidebar with mobile drawer"
```

---

### Task 12: AICoachPage rewrite + cleanup

**Agent:** `react-native-engineer`

**Files:**
- Rewrite: `frontend/src/pages/AICoachPage.tsx`
- Delete: `frontend/src/components/ai-coach/BestTimesInput.tsx`
- Delete: `frontend/src/components/ai-coach/TemplateSelector.tsx`
- Delete: `frontend/src/components/ai-coach/PromptTips.tsx`
- Delete: `frontend/src/components/ai-coach/WorkoutOutput.tsx`

- [ ] **Step 1: Rewrite AICoachPage**

Three-panel layout:
```
height: calc(100vh - 64px)  // below GlobalNav
display: flex
overflow: hidden
```

Left: `ConversationSidebar`
Right: flex column with `ChatThread` (flex-1 overflow-y-auto) + `ChatInput` (sticky bottom)

State management via `useAICoach` hook.

Flow:
- On mount: fetch conversation list
- New chat: show KickoffForm in chat area
- Kickoff submit: `createConversation()` → `sendMessage(prompt, metadata)`
- Select conversation: `selectConversation(id)` → show messages
- Send refinement: `sendMessage(content)` → optimistic append + AI response
- Quick action: pre-build message text → `sendMessage()`
- Save workout: extract latest assistant content → call workout create API

Mobile: hide sidebar, show mobile header with conversation title + history icon

- [ ] **Step 2: Delete old components**

Remove BestTimesInput, TemplateSelector, PromptTips, WorkoutOutput.

- [ ] **Step 3: Verify the page loads and renders**

```bash
cd frontend && npm run dev
# Navigate to /tools/ai-coach
```

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend && npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(sp3): rewrite AICoachPage — chat-based interface with conversation history"
```

---

### Task 13: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Test full flow**

1. Open AI Coach page
2. Type a free-text prompt → should create conversation + show AI response
3. Click "Add more context" → fill structured fields → submit
4. Use quick actions (Make Harder) → should refine workout
5. Edit a section inline → Done → section updates
6. Click "Save as Workout" → should save + show success
7. Navigate away → return → sidebar shows conversation
8. Click past conversation → messages load
9. Delete a conversation → confirmation → removed
10. Test on mobile viewport (resize browser to 390px width)

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(sp3): complete AI Coach chat interface with conversation persistence"
```
