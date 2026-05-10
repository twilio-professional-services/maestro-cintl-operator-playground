# Conversation Intelligence Operator Playground — Web UI

A browser-based tool for testing [Twilio Conversation Intelligence](https://www.twilio.com/docs/conversation-intelligence) operators. You create or generate conversation transcripts, replay them through the Conversation Orchestrator, and watch operator results arrive in real time — without needing a real phone or agent.

## Why

Testing Conversation Intelligence operators normally requires live calls and real participants. This tool removes that friction: write a scenario, generate a realistic transcript, simulate the call, and immediately see what your operators extract — summaries, sentiment, custom extractions, whatever you've configured.

It also integrates with Twilio Conversation Memory so you can see what observations and summaries a conversation writes to a customer's profile, manage profiles, and clear memory between test runs.

## Features

- **Transcripts** — upload JSON transcripts or generate them with AI (requires OpenAI API key)
- **Simulated Calls** — replay a transcript through the Conversation Orchestrator and stream Conversation Intelligence operator results in real time
- **Customer Memory** — view observations and conversation summaries written to a customer profile after a simulated call
- **Profiles** — manage Conversation Memory customer profiles; assign a profile phone number when starting a simulated call so memory accumulates across runs; clear memory per profile

## Prerequisites

- Node.js 18+
- A Twilio account with Conversation Intelligence configured
- A Conversation Orchestrator Conversation Configuration ID
- An OpenAI API key *(only required for AI transcript generation)*

## Setup

```bash
cd web
npm install
cp .env.example .env.local
```

Edit `.env.local` and fill in your credentials:

```
# Required
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CONVERSATION_CONFIGURATION_ID=conv_configuration_xxxxxxxxxxxxxxxxxxxxxxxxx

# Required only for "Generate with AI" — omit if you'll upload transcripts manually
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note:** Without `OPENAI_API_KEY` you can still upload hand-crafted JSON transcripts. The "Generate with AI" button will return an error if the key is missing.

## Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Transcript format

If uploading transcripts manually they must follow this shape:

```json
{
  "metadata": { "name": "Billing dispute", "description": "Customer disputes a charge" },
  "participants": {
    "customer": { "address": "+14155550001", "channel": "VOICE" },
    "agent":    { "address": "+14155550002", "channel": "VOICE" }
  },
  "messages": [
    { "role": "customer", "text": "Hi, I was charged twice this month." },
    { "role": "agent",    "text": "I can look into that for you." }
  ]
}
```

Supported channels: `VOICE`, `SMS`, `EMAIL`. Customer and agent must use the same channel.

## Conversation Memory (optional)

If your Conversation Configuration has a linked Conversation Memory store, the **Customer Memory** tab on a completed simulated call will show observations and conversation summaries extracted from the conversation. The **Profiles** page lets you create profiles, assign them to simulated calls (so the same phone number is used every run), and clear accumulated memory.

No additional configuration is required — the Memory Store ID is read automatically from your Conversation Configuration.
