# AI Coach Re-Engineer — SP3: Frontend Redesign

**Date:** 2026-03-19
**Status:** Approved
**Branch:** `feature/add-search-swimmer-feature`
**Part of:** AI Coach Re-Engineer (4 sub-projects: SP1 → SP2 → SP3 → SP4)
**Depends on:** SP2 (two-stage retrieval + coach style engine)

## Problem

The current AI Coach frontend is a single prompt box with an output display. No conversation history, no iterative refinement, no structured inputs, no inline editing. Coaches generate one workout, copy it, and leave. There's no way to say "make it harder" or surgically edit one section.

## Goal

Replace the AI Coach page with a chat-based interface that supports structured kickoff, conversational refinement, inline section editing, quick actions, persistent conversation history, and one-click save to workout templates.

## Page Layout

Three-panel layout:

```
┌──────────────┬─────────────────────────────────────┐
│              │                                     │
│  Sidebar     │  Chat Area                          │
│              │                                     │
│  [+ New]     │  ┌─────────────────────────────┐   │
│              │  │ Structured Kickoff Form      │   │
│  Recent:     │  │ (focus, distance, level...)  │   │
│  - Sprint    │  └─────────────────────────────┘   │
│    Tuesday   │                                     │
│  - Endurance │  ┌─ Coach message ──────────────┐   │
│    Builder   │  │ "3000m sprint for seniors"    │   │
│  - IM Focus  │  └──────────────────────────────┘   │
│              │                                     │
│              │  ┌─ AI response ────────────────┐   │
│              │  │ Warm-up: 400 choice           │   │
│              │  │ 8x50 kick @1:00               │   │
│              │  │ Main set: 12x50 Free @:40     │   │
│              │  │ [Edit Section] [Regenerate]   │   │
│              │  │                               │   │
│              │  │ [Make Harder] [Add Kick] ...  │   │
│              │  │ [Save as Workout]             │   │
│              │  └──────────────────────────────┘   │
│              │                                     │
│              │  ┌─ Input ──────────────────────┐   │
│              │  │ Type a refinement...     [Send]│   │
│              │  └──────────────────────────────┘   │
└──────────────┴─────────────────────────────────────┘
```

- **Sidebar** (overlay drawer on mobile): "New Chat" button + list of past conversations, sorted by `updated_at DESC`
- **Chat area**: messages flow top-to-bottom in a left-aligned thread (not mirrored bubbles). New conversations show the free-text input with optional structured form. Existing conversations show full message history.
- **Input bar**: sticky bottom, free-text with send button. Disabled during AI generation (shows loading indicator reusing the existing wave animation from WorkoutOutput).

### Layout Height

The page uses `calc(100vh - 64px)` (nav height) with `overflow: hidden` and flex layout. Sidebar and chat area each have `h-full overflow-y-auto`. This prevents the chat from extending past the viewport and ensures the input bar stays anchored.

### Mobile Layout

On mobile, the sidebar is removed from DOM flow entirely. The page header shows the active conversation name + a "History" icon button that opens an overlay drawer (85-90% screen width). The drawer auto-closes when a conversation is selected. The input bar uses `env(safe-area-inset-bottom)` padding, and the chat area uses `overscroll-behavior: contain` to prevent keyboard collision issues.

## New Conversation Flow

When starting a new conversation, the **free-text input is the primary entry point** — large and prominent at the center of the empty chat area. The coach can type "3000m sprint for seniors" and hit Enter immediately.

Below the input, an **"Add more context" expandable section** reveals the structured kickoff form. This is an optional enhancement, not a gate.

### Structured Kickoff Form (optional)

| Field | Input Type | Options | Required |
|-------|-----------|---------|----------|
| Training Focus | Button group (single select, `role="radiogroup"`) | Sprint, Endurance, Technique, IM, Kick, Recovery, Race Prep | No |
| Target Distance | Dropdown (`<select>`) | 1500m–6000m in 500m increments | No |
| Level | Button group (`role="radiogroup"`) | Age Group, Senior, Masters | No |
| Stroke Emphasis | Button group (`role="radiogroup"`) | Freestyle, Backstroke, Breaststroke, Butterfly, IM, Mixed | No (default: Mixed) |

All fields are optional — they enrich the prompt and improve metadata filtering but aren't required. If the coach selects "Sprint" and "Senior" and types "focus on underwater kicks", the prompt becomes: "Generate a sprint workout for senior swimmers. Focus on underwater kicks."

**On submit (or Enter in text input):**
1. Build natural-language prompt by combining structured selections + free text
2. Create a new conversation via API
3. Send as the first message
4. Form collapses, chat thread begins
5. Structured data feeds the SP2 metadata filter for ChromaDB retrieval

## Chat Messages

### Coach Message
Left-aligned, understated block. Shows the coach's prompt or refinement text. Not right-aligned "chat bubbles" — this is a coaching tool, not iMessage. The coach's messages are commands/requests, not conversation.

### AI Workout Response
Structured card containing:

**Workout sections** — the workout text is parsed and displayed as clickable sections:
- Warm-up
- Pre-set (if present)
- Main Set
- Cool-down

Each section has:
- **Always-visible** faint edit icon to the right of the section header (`text-slate-600`, transitions to `text-cyan-400` on hover). Not hover-only — must be visible on mobile/touch.
- Section headers use `text-xs font-semibold text-cyan-400 uppercase tracking-wide` for scannable rhythm
- Clicking the icon (or tapping the section on mobile) opens an inline textarea editor
- Textarea auto-sizes to content height (no internal scroll). Has `aria-label="Edit [section name]"`
- "Done" button saves the edit + "Cancel" button to abandon without losing AI text
- If the coach then sends a refinement message, the AI uses the manually-edited version as the base

**Quick action buttons** below the workout (only on the **latest** AI message — historical cards show no actions):
- **Primary actions:** `Make Harder` | `Make Easier` — ghost buttons, slightly larger
- **Secondary actions:** `Add Kick` | `Add Drill` | `Shorten` | `Lengthen` — smaller chips
- Clicking sends a pre-built refinement message into the chat (e.g., "Make this workout harder with tighter intervals and higher intensity")
- These are contextual convenience buttons, not magic — they just pre-fill the chat input

**Save button** (visually separated from quick actions, gradient CTA style):
- `Save as Workout` — saves the current workout version to `workout_template`
- Triggers AI title + description generation (existing endpoints)
- Shows success toast with link to the saved workout
- After save: changes to "Saved as [title]" with link to the template
- On historical cards that were saved: subtle "Saved as [title]" label, no action buttons

### Refinement Flow
1. Coach types "make it harder" or clicks `Make Harder` button
2. Chat shows the message as a coach bubble
3. AI responds with a complete updated workout (full workout, not a diff)
4. Previous workout version stays visible in the chat thread (scroll up to compare) — read-only, no action buttons
5. Only the latest AI response has active quick action buttons + save button

## Section Editing

The AI workout response is parsed into sections for inline editing:

**Parsing strategy:** Split the workout text by section headers. Look for patterns:
- "Warm-up:" or "Warmup:" or "WU:"
- "Pre-set:" or "Pre set:"
- "Main set:" or "Main:"
- "Cool-down:" or "Cooldown:" or "CD:"

If parsing fails (unusual format), show the full workout as a single editable block.

**Edit flow:**
1. Coach clicks "Edit" icon on a section (e.g., Main Set)
2. Section becomes a textarea with the current text
3. Coach modifies directly
4. Clicks "Done" → card updates in place
5. The edit is stored in the message metadata (so it persists on page reload)
6. Next AI refinement uses the edited workout as context

## Conversation Persistence

### New database table: `ai_coach_conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `coach_id` | UUID FK → coach (CASCADE) | Owner |
| `title` | String(200) | Auto-generated from first prompt (first 50 chars), editable |
| `created_at` | DateTime (tz) | server_default=now() |
| `updated_at` | DateTime (tz) | Updated on each new message |

Index on `coach_id` for listing.

### New database table: `ai_coach_messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `conversation_id` | UUID FK → ai_coach_conversations (CASCADE) | Parent |
| `role` | String(20) | "coach" or "assistant" |
| `content` | Text | Message text (coach) or full workout text (assistant) |
| `metadata` | JSONB, nullable | For assistant: `{sections: {warmup: "...", main: "...", cooldown: "..."}, edited_sections: {...}}`. For coach: `{kickoff_params: {...}}` on first message. |
| `created_at` | DateTime (tz) | Message order, server_default=now() |

Index on `conversation_id` for loading messages.

No pagination — conversations are short (typically 3-10 messages). Load all messages when selecting a conversation.

### Sidebar Behavior
- Shows last 20 conversations for the authenticated coach
- Sorted by `updated_at DESC`
- Title = first 50 chars of the coach's first message, or the saved workout name
- Click to load full message history
- Delete via icon button (with confirmation)
- "New Chat" button at top clears the chat area and shows kickoff form

## API Changes

### New Endpoints

**`GET /api/ai-coach/conversations`**
- Auth: required (coach)
- Returns: last 20 conversations `[{id, title, created_at, updated_at, message_count}]`

**`POST /api/ai-coach/conversations`**
- Auth: required
- Body: `{title?: string}`
- Creates a new conversation, returns `{id, title, created_at}`

**`GET /api/ai-coach/conversations/:id`**
- Auth: required (must own conversation)
- Returns: conversation + all messages `{id, title, messages: [{id, role, content, metadata, created_at}]}`

**`DELETE /api/ai-coach/conversations/:id`**
- Auth: required (must own)
- Deletes conversation and all messages (CASCADE)

**`POST /api/ai-coach/conversations/:id/messages`**
- Auth: required (must own)
- Body: `{content: string, metadata?: object}`
- This is the main endpoint:
  1. Saves the coach message to the database
  2. Loads conversation history (all prior messages)
  3. Runs two-stage retrieval (SP2) with the latest coach message as the query
  4. Calls Claude with: system prompt + coach style + conversation history + retrieved examples
  5. Saves the AI response as a new message
  6. Returns: `{coach_message: {...}, assistant_message: {...}}`

### Modified Endpoints

**`POST /api/ai-coach/generate`** — keep for backward compatibility but mark as deprecated. The new flow uses `/conversations/:id/messages`.

### Conversation Context for Claude

When calling Claude for a refinement, include the full conversation history (not just the latest message). This gives Claude context for follow-ups like "make it harder" or "now change the stroke":

```
messages: [
  {role: "user", content: "Generate a 3000m sprint workout for seniors..."},
  {role: "assistant", content: "Warm-up: 400 choice\n..."},
  {role: "user", content: "Make it harder with tighter intervals"},
  // Claude generates the next assistant response
]
```

## Frontend Component Architecture

### New Files

```
frontend/src/
├── pages/
│   └── AICoachPage.tsx              # Complete rewrite — three-panel layout
├── components/ai-coach/
│   ├── ConversationSidebar.tsx      # Past conversations list + New Chat button
│   ├── KickoffForm.tsx              # Structured form (focus, distance, level, stroke, notes)
│   ├── ChatThread.tsx               # Scrollable message list, auto-scroll on new message
│   ├── ChatMessage.tsx              # Single message bubble (coach or assistant)
│   ├── WorkoutCard.tsx              # AI response: sectioned workout + quick actions + save
│   ├── WorkoutSection.tsx           # Single editable workout section (warmup/main/cooldown)
│   ├── QuickActions.tsx             # Make Harder, Add Kick, etc. button row
│   └── ChatInput.tsx                # Bottom input bar with send button
├── hooks/
│   └── useAICoach.ts                # Rewrite — conversation CRUD, message send, state
├── services/
│   └── aiCoachService.ts            # Add conversation endpoints, keep existing generate for compat
├── types/
│   └── ai-coach.ts                  # Conversation, Message, WorkoutSections, KickoffParams types
```

### Removed Files

- `BestTimesInput.tsx` — no longer needed (coach writes paces in notes)
- `TemplateSelector.tsx` — replaced by KickoffForm
- `PromptTips.tsx` — replaced by KickoffForm
- `WorkoutOutput.tsx` — replaced by WorkoutCard

### Component Responsibilities

**`AICoachPage.tsx`** — layout container. Manages which conversation is active. Renders sidebar + chat area + input.

**`ConversationSidebar.tsx`** — presentational. Receives conversation list, selected ID, onSelect, onNew, onDelete callbacks. Collapsible on mobile.

**`KickoffForm.tsx`** — self-contained form. On submit, calls parent's `onKickoff(params)` which creates a conversation and sends the first message.

**`ChatThread.tsx`** — scrollable container. Maps messages to `ChatMessage` components. Auto-scrolls to bottom on new messages.

**`ChatMessage.tsx`** — renders either a simple coach bubble or delegates to `WorkoutCard` for assistant messages.

**`WorkoutCard.tsx`** — renders pre-parsed workout sections via `WorkoutSection`, shows `QuickActions` and save button. Only the latest assistant message shows active actions. Section parsing logic lives in a pure utility function `parseWorkoutSections(text: string): WorkoutSections` (in `utils/` or co-located) — not inside the component.

**`WorkoutSection.tsx`** — displays section text with edit-on-click. Manages its own edit state (viewing vs editing).

**`QuickActions.tsx`** — row of buttons. Each calls parent's `onAction(actionType)` which sends a pre-built message.

**`ChatInput.tsx`** — textarea + send button. Disabled during generation. Handles Enter to send, Shift+Enter for newline.

### State Management

**`useAICoach.ts` hook** manages:
- `conversations: Conversation[]` — sidebar list (fetched on mount)
- `activeConversation: Conversation | null` — currently selected
- `messages: Message[]` — messages for active conversation
- `isGenerating: boolean` — loading state
- `createConversation()` → POST /conversations
- `loadConversation(id)` → GET /conversations/:id
- `sendMessage(content, metadata?)` → POST /conversations/:id/messages
- `deleteConversation(id)` → DELETE /conversations/:id
- `saveWorkout(messageId)` → extracts workout text, calls existing workout create endpoint

Uses **React Query** for conversation list caching (consistent with app patterns). Individual conversation messages loaded on selection.

## Styling

The app uses a **dark-first theme** (`bg-slate-950` page background, `bg-slate-900/90` cards, `text-slate-100` text). All new components must follow this — no light theme colors.

### Sidebar
- Desktop: `w-64` fixed, `bg-slate-900` background, `border-r border-slate-800` separator
- Sits below the GlobalNav using flex column layout (`h-[calc(100vh-nav-height)]`)
- Mobile: **overlay drawer** (not icon-only rail) — slides in from left with backdrop, consistent with ChatGPT/Claude.ai pattern
- Conversation items: `hover:bg-slate-800 rounded-lg px-3 py-2`, active conversation: `bg-slate-800`

### Chat Messages
- Coach messages: `bg-slate-800 border border-slate-700 rounded-xl rounded-tl-sm text-slate-100 px-4 py-3` — left-aligned, understated block with subtle left-border accent `border-l-2 border-cyan-500/20`
- AI workout cards: `bg-slate-900/90 backdrop-blur-xl border border-slate-800/60 rounded-2xl shadow-xl p-4` — left-aligned, full width within content column

### Quick Actions
- Show **only on the latest AI message** — historical workout cards have no action buttons
- Two tiers: primary actions (Make Harder, Make Easier) as ghost buttons `border border-slate-700 hover:border-cyan-500 py-1.5 px-3 text-xs`, secondary (Add Kick, Add Drill, Shorten, Lengthen) as smaller chips
- Total row height under 40px

### Save Button
- Visually elevated above quick actions: `mt-4 pt-4 border-t border-slate-800`
- Gradient CTA style: `bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg py-2 px-4`
- After save: changes to `text-emerald-400` label "Saved as [title]" with link to the template
- On historical cards that were saved: subtle "Saved as [title]" link, no action buttons

### Kickoff Form Button Groups
- Unselected: `border border-slate-700 text-slate-400 hover:border-slate-500 py-2 px-4 rounded-lg text-sm font-medium`
- Selected: `bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 py-2 px-4 rounded-lg text-sm font-medium`

### Input Bar
- Sticky bottom, `border-t border-slate-800` separator, `bg-slate-900` background
- Textarea: `bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20`

### Section Editing
- Edit textarea: `bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-lg`
- "Done" button: small ghost button `border border-cyan-500 text-cyan-400 text-xs`

## Accessibility

- **Kickoff button groups:** Use `role="radiogroup"` with `role="radio"` children and roving `tabindex` — one tab stop per group, arrow keys navigate within
- **Distance dropdown:** Native `<select>` element (accessible by default)
- **Section edit textareas:** `aria-label="Edit [section name]"` (e.g., "Edit Main Set")
- **Generation loading state:** `aria-live="polite"` region announces "Generating workout, please wait"
- **New messages:** `aria-live="polite"` on chat thread container for screen reader announcement
- **Keyboard:** Enter sends message, Shift+Enter for newline, Escape cancels section edit

## Error Handling

- **Generation fails:** Show error message in chat as a system message ("Failed to generate workout. Try again.") with retry button
- **Conversation load fails:** Show error state in chat area with retry
- **Save fails:** Toast notification with error, button remains active for retry
- **Network errors:** Optimistic UI for coach messages (show immediately), roll back if send fails
- **Empty conversation list:** Show friendly empty state with "Start your first AI coaching session" CTA

## Success Criteria

- [ ] Chat-based conversation flow with persistent history
- [ ] Structured kickoff form converts to first message
- [ ] AI workout responses parsed into editable sections
- [ ] Quick action buttons send pre-built refinement messages
- [ ] Inline section editing persists across page reloads
- [ ] One-click save to workout_template with auto title/description
- [ ] Sidebar shows last 20 conversations, sorted by recent
- [ ] Previous workout versions visible in thread (scroll up to compare)
- [ ] Mobile-responsive (sidebar collapses to drawer)
- [ ] Conversation context sent to Claude for coherent follow-ups

## Out of Scope (SP4)

- Workout quality scoring / thumbs up/down
- Analytics on which prompts produce best results
- Coach style display in the UI
- Sharing conversations between coaches
