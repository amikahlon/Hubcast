# Phase 5: Chat UI

**Goal:** build a simple and polished React chat UI for Hubcast using the existing `POST /chat` API.

The UI should feel like a real weather risk product, not a generic chatbot. Keep the focus on the conversation and the quality of the answers.

## Tasks

### 1. API client

Create a small API client in `web/src/api.ts`.

Add:

- `sendChat(threadId, message)` using `POST /api/chat`
- `fetchHubs()` using `GET /api/hubs`
- Validate chat responses with the existing `ChatResponseSchema`
- Convert API, network and invalid response errors into short readable messages

Do not add another API library. Use `fetch`.

### 2. Conversation state

Keep the conversation state inside React.

Each chat has one `threadId` created with `crypto.randomUUID()`.

Use the same `threadId` for every message in the conversation so LangGraph can keep the conversation history.

Store user messages, assistant responses and errors.

Allow only one request at a time.

Add a `New chat` action that:

- cancels the current request if needed
- creates a new `threadId`
- clears the visible conversation

Use `AbortController` for cancellation.

Do not persist conversation history. Refreshing the page starts a new chat.

### 3. Chat layout

Replace the Phase 1 status page with the Hubcast chat.

The page should include:

- a simple Hubcast header
- a `New chat` button
- the conversation
- a message composer at the bottom

User and assistant messages should be visually different.

Automatically scroll to the latest message.

The composer should support:

- Enter to send
- Shift+Enter for a new line
- disabled send while loading
- disabled send for an empty message
- the existing 2000 character limit

### 4. Empty state

Before the first message, show a short introduction to Hubcast.

Explain that Hubcast helps explore weather risk across the company's distribution hubs.

Show the 4 main example questions as clickable suggestions.

Clicking a suggestion should send it directly.

The suggestions disappear after the conversation starts.

Give this screen a small Hubcast visual identity related to weather, risk and logistics.

Keep it clean. Do not add a dashboard, map or charts.

### 5. Loading and errors

While waiting for Claude, show a simple loading indicator as part of the conversation.

Keep the user's message visible.

If the request fails, show a readable error inside the conversation.

Add a `Try again` action that sends the failed message again using the same `threadId`.

Starting a new chat should cancel an active request and ignore any late response from the previous chat.

### 6. Assistant answers

Display assistant responses in a clear order:

1. `answer`
2. relevant hubs
3. `explanation`
4. `assumptions`, only when present
5. sources and `dataAsOf`

Convert hub IDs into readable city and state names using `GET /hubs`.

If the hub list cannot be loaded, fall back to the original hub ID.

Do not show `toolCalls` in the normal UI.

Keep sources and the data date visible but visually secondary.

### 7. Plain text answers

Keep assistant answers simple to render.

Update the agent system prompt so normal answers use plain text instead of Markdown formatting.

Claude may use short paragraphs and simple lines when useful.

Do not add a Markdown rendering library.

Do not change any scoring, tools or agent behavior beyond this formatting instruction.

### 8. Design and responsive behavior

Use plain CSS and the existing React setup.

The design should be:

- clean
- modern
- calm
- professional
- clearly connected to Hubcast and weather risk

Use one main content column with a comfortable maximum width.

Support desktop and mobile layouts.

The composer should remain easy to use on small screens.

Support the system light and dark theme.

Keep good contrast, visible keyboard focus and readable text.

Avoid unnecessary animations and visual effects.

Do not add UI or state libraries.

### 9. Manual verification

Test the UI in the browser using the real server and Anthropic model.

Check:

- all 4 main example questions
- a follow-up question using the same conversation
- loading state
- API error state
- `Try again`
- `New chat`
- mobile width
- desktop width
- light mode
- dark mode
- keyboard input

Confirm that follow-up questions keep the same `threadId`.

Confirm that `New chat` creates a new `threadId`.

Run typecheck and lint when finished.

## Decisions

- Chat-first UI, not a dashboard
- One `threadId` per conversation
- Conversation history is not persisted
- Reloading the page starts a new conversation
- LangGraph remains responsible for server-side conversation memory
- Plain text answers instead of Markdown rendering
- `toolCalls` stay hidden from the normal user interface
- Hub names come from the existing `/hubs` endpoint
- No new frontend libraries unless required by the existing project

## Out of scope

Streaming, saved conversations, multiple conversation history, maps, charts, dashboards, authentication, routing, Markdown rendering, theme controls, export, sharing, feedback systems and server API changes.

## Done when

- The user can send a question and receive a clear answer
- Follow-up questions work in the same conversation
- `New chat` starts a separate conversation
- Loading, error and retry states work
- Answers clearly show the result, explanation, assumptions, sources and data date
- The 4 example questions work from the empty state
- The UI looks polished on desktop and mobile
- Light and dark mode are usable
- The existing backend behavior is unchanged
- Typecheck and lint pass