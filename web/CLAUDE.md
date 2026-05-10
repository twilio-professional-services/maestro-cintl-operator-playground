# Web UI — Implementation Reference

Next.js 14 app (App Router, TypeScript, Tailwind, SQLite via `better-sqlite3`). All pages are client components; all data fetching goes through Next.js API routes.

## Key directories

```
src/
  app/
    api/                        # API routes
      transcripts/              # GET list, POST upload
        generate/               # POST — AI generation via OpenAI
        [id]/                   # GET single, DELETE
      simulated-calls/          # GET list, POST create+replay
        [id]/                   # GET detail (call + transcript + operator results)
          stream/               # GET SSE stream for live operator results
          memory/               # GET Conversation Memory (observations + summaries)
      profiles/                 # GET list, POST create
        [profileId]/            # DELETE profile
          clear-memory/         # POST delete all obs+summaries for profile
      intelligence-config/      # GET configured operators from Conversation Intelligence
    webhook/operator/           # POST receive operator result webhooks from Conversation Intelligence
    transcripts/                # Transcript list + generate modal
      [id]/                     # Transcript detail + profile selector + start call
    simulated-calls/            # Simulated call list
      [id]/                     # Call detail: transcript left, tabbed panel right
    profiles/                   # Profile list + create form + clear/delete actions
  lib/
    db.ts                       # SQLite schema + all DB helpers
    maestro-client.ts           # Axios client for Conversation Orchestrator (conversations.twilio.com/v2)
    memora.ts                   # Shared Conversation Memory helpers: basicAuth, getMemoryStoreId, memoraFetch, fetchAllPages
    replay.ts                   # runReplay(transcript, callId, customerPhone?) — fire-and-forget
  types.ts                      # All shared TypeScript interfaces
```

## Product naming (official Twilio names)

- **Conversation Orchestrator** — the service that groups communications into conversations (`conversations.twilio.com/v2`)
- **Conversation Intelligence** — the operator platform that analyses conversations (`intelligence.twilio.com/v3`)
- **Conversation Memory** — persistent customer profiles, observations, and summaries (`memory.twilio.com/v1`)

## Database (SQLite, `data/playground.db`)

Three tables managed in `src/lib/db.ts`:

- **transcripts** — `id, name, description, content (JSON string), created_at`
- **simulated_calls** — `id, transcript_id, conversation_id, status, created_at, updated_at`
- **operator_results** — `id, simulated_call_id, conversation_id, payload (JSON string), received_at`

## Data flow

1. User uploads or generates a transcript → stored in `transcripts`
2. User clicks "Start Simulated Call" (optionally selecting a profile phone) → `POST /api/simulated-calls` → creates `simulated_calls` row → fires `runReplay()` async
3. `runReplay()` creates a Conversation Orchestrator conversation, adds CUSTOMER + HUMAN_AGENT participants, sends each message as a communication, then closes the conversation
4. Conversation Intelligence operators fire and send webhook payloads to `POST /webhook/operator` → stored in `operator_results`
5. Frontend polls via SSE (`/api/simulated-calls/[id]/stream`) and streams new results in real time

## Transcript format (stored in `content` column as JSON)

```typescript
{
  metadata: { name, description?, sentiment?: "positive"|"negative"|"neutral"|"mixed" }
  participants: {
    customer: { address: string, channel: "VOICE"|"SMS"|"EMAIL" }
    agent:    { address: string, channel: "VOICE"|"SMS"|"EMAIL" }
  }
  messages: Array<{ role: "customer"|"agent", text: string }>
}
```

Generated transcripts use `+10000000000` as the customer address — this is overridden at replay time by the selected profile phone if one is chosen.

## Conversation Memory integration

All Conversation Memory calls live in `src/lib/memora.ts`:
- Auth: Basic `TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN` — same as all other Twilio calls
- `storeId`: fetched dynamically from `GET conversations.twilio.com/v2/ControlPlane/Configurations/{CONVERSATION_CONFIGURATION_ID}` → `response.memoryStoreId`
- Base URL: `https://memory.twilio.com/v1`

Key operations used:
- `POST /Stores/{storeId}/Profiles/Lookup` — resolve profileId from phone number
- `GET /Stores/{storeId}/Profiles/{profileId}/Observations` — paginated, filter by `conversationIds.includes(conversationId)`
- `GET /Stores/{storeId}/Profiles/{profileId}/ConversationSummaries` — paginated, filter by `conversationId`
- `POST /Stores/{storeId}/Profiles` — create profile with Contact traits
- `DELETE /Stores/{storeId}/Profiles/{profileId}` — delete profile
- Individual observation/summary DELETE for clear-memory

The `profileId` for a simulated call is extracted from stored Conversation Intelligence operator webhook payloads (`executionDetails.participants.find(p => p.type === "CUSTOMER")?.profileId`), with a Lookup fallback.

## AI transcript generation

Uses `gpt-4o-mini` via the OpenAI SDK with `response_format: { type: "json_object" }`. The system prompt specifies the exact TypeScript shape, sentiment tone rules, and placeholder phone. Frontend sends `{ scenario, testGoal?, messageCount, sentiment? }` — the API accepts both `scenario` and `description` field names for backwards compat.

## Env vars

| Variable | Required | Purpose |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Yes | Auth for all Twilio APIs |
| `TWILIO_AUTH_TOKEN` | Yes | Auth for all Twilio APIs |
| `CONVERSATION_CONFIGURATION_ID` | Yes | Identifies which Conversation Orchestrator config to use; also used to look up the Conversation Memory store ID |
| `OPENAI_API_KEY` | Only for AI generation | GPT-4o-mini transcript generation |

## Simulated call detail page tabs

Right panel has two tabs:
- **Operator Results** — live-streaming cards from Conversation Intelligence webhooks, filterable by operator
- **Customer Memory** — fetched on first tab click (lazy), refresh button for when memory isn't ready yet, toggle between "this conversation only" and "all conversations" for observations

## Profile selector

On the transcript detail page a dropdown appears if any Conversation Memory profiles exist. Selecting one overrides the customer address in the Conversation Orchestrator conversation. The transcript phone (`+10000000000`) is used when no profile is selected.
