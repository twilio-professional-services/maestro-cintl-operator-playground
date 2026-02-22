# Transcript Replay CLI Tool

A CLI tool that replays conversation transcripts through Maestro (Conversations Service) to test Conversational Intelligence operator results.

## Overview

This tool helps you test your Conversational Intelligence operators by:

1. Starting a local webhook server to receive operator events
2. Creating a conversation in Maestro with participants (CUSTOMER and HUMAN_AGENT)
3. Replaying each message from a transcript as a communication in the conversation
4. Buffering Conversational Intelligence webhooks during replay (silent mode)
5. Closing the conversation to trigger conversation_end operators
6. Logging all buffered operator result webhooks after conversation closes
7. Switching to real-time webhook logging for ongoing operator results

## Prerequisites

Before using this tool, you must have:

1. **Twilio Account Credentials**
   - Account SID
   - Auth Token

2. **Maestro Conversation Configuration**
   - Conversation Configuration ID (format: `conv_configuration_...`)
   - Linked to Intelligence Service Configuration via console

3. **Conversational Intelligence Service Configuration**
   - At least one operator configured (e.g., CONVERSATION_SUMMARY, SCRIPT_ADHERENCE)
   - Webhook action configured with your ngrok URL
   - Appropriate trigger settings (COMMUNICATION or conversation_end)

4. **ngrok** running to expose your local webhook server
   ```bash
   ngrok http 3000
   ```

## Installation

```bash
cd cli
npm install
npm run build
```

## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:

   ```bash
   # REQUIRED: Your Twilio credentials
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here

   # REQUIRED: Conversation Configuration ID
   CONVERSATION_CONFIGURATION_ID=conv_configuration_00000000000000000000000000

   # Optional: Webhook server configuration
   WEBHOOK_PORT=3000
   WEBHOOK_PATH=/webhook/operator
   ```

3. Make sure your Intelligence Service Configuration webhook URL points to:
   ```
   https://your-ngrok-url.ngrok.io/webhook/operator
   ```

## Usage

This tool provides two main commands:

### Replay Command

Replay a conversation transcript through Maestro to test operator results:

```bash
npm start replay <transcript-file.json>
```

**Example:**

```bash
npm start replay sample-transcripts/customer-service-call.json
```

### Extract Command

Extract an existing conversation from Maestro and save it as a transcript JSON file:

```bash
npm start extract <callSid> [--output path/to/file.json]
```

**Arguments:**
- `callSid` - Required: The call SID (channel ID) to fetch from Maestro
- `--output` or `-o` - Optional: Custom output path (default: `extracted-transcripts/<callSid>.json`)

**Example:**

```bash
# Extract with default output path
npm start extract CA1234567890abcdef1234567890abcd

# Extract with custom output path
npm start extract CA1234567890abcdef1234567890abcd --output /tmp/my-transcript.json
```

**Expected Output:**

```
Fetching conversation with call SID: CA1234567890abcdef1234567890abcd
✓ Found conversation: conv_01JCMXYZ
✓ Fetched 2 participants
✓ Fetched 7 communications
✓ Successfully extracted transcript

✓ Transcript saved to: extracted-transcripts/CA1234567890abcdef1234567890abcd.json
  Name: Customer Service Call
  Messages: 7
  Customer: +15551234567 (VOICE)
  Agent: +15559876543 (VOICE)
```

**Round-Trip Workflow:**

The extract command enables a powerful testing workflow:

1. Run a real call through Maestro with operators configured
2. Extract the conversation transcript using the call SID
3. Modify your operator configurations
4. Replay the extracted transcript to test the changes
5. Iterate without needing to make new live calls each time

```bash
# 1. Extract from a real conversation
npm start extract CA1234567890abcdef1234567890abcd

# 2. Replay to test operator changes
npm start replay extracted-transcripts/CA1234567890abcdef1234567890abcd.json
```

**Channel Handling:**

The extract command maps Maestro channels to the transcript format:

| Maestro Channel | Transcript Channel | Notes |
|----------------|-------------------|--------|
| SMS | SMS | Direct mapping |
| VOICE | VOICE | Direct mapping |
| EMAIL | EMAIL | Direct mapping |
| WHATSAPP | SMS | Mapped with warning |
| RCS | SMS | Mapped with warning |
| CHAT | SMS | Mapped with warning |
| Other | SMS | Default with warning |

**Content Type Handling:**

The extract command handles different communication content types:

- `TEXT` - Extracted directly
- `TRANSCRIPTION` - Text extracted from transcription (voice calls)
- Other types - Skipped with warning

**Important Notes:**

- The extract command only requires `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` (no `CONVERSATION_CONFIGURATION_ID` needed)
- Extracted transcripts are saved to `extracted-transcripts/` by default, which is ignored by git
- The directory is preserved but individual JSON files are not committed (they may contain customer data)

## Transcript Format

Transcripts are JSON files with the following structure:

```json
{
  "metadata": {
    "name": "Customer Service Call - Order Status Inquiry",
    "description": "Customer calls to check order status, agent follows script"
  },
  "participants": {
    "customer": {
      "address": "+15551234567",
      "channel": "VOICE"
    },
    "agent": {
      "address": "+15559876543",
      "channel": "VOICE"
    }
  },
  "messages": [
    {
      "role": "agent",
      "text": "Thank you for calling customer support..."
    },
    {
      "role": "customer",
      "text": "Hi, I placed an order last week..."
    }
  ]
}
```

### Fields

- `metadata.name` - Name of the conversation (required)
- `metadata.description` - Description of the scenario (optional)
- `participants.customer` - Customer participant details
  - `address` - Phone number or identifier
  - `channel` - Communication channel (VOICE, SMS, EMAIL)
- `participants.agent` - Agent participant details
- `messages` - Array of messages
  - `role` - Either "customer" or "agent"
  - `text` - Message content

## Expected Output

```
[STEP 1] Starting webhook server...
  Listening on port 3000
  Webhook path: /webhook/operator
  Make sure your Intelligence Config webhook URL points to: https://your-ngrok-url/webhook/operator

[STEP 2] Creating Maestro conversation...
  Conversation ID: conv_01JCMXYZ
  Configuration ID: conv_configuration_00000000000000000000000000

[STEP 3] Adding participants...
  Customer Participant ID: comms_participant_abc123
  Agent Participant ID: comms_participant_def456

[STEP 4] Replaying 7 messages...
  [1/7] agent: "Thank you for calling customer support. My name is Sarah. How..."
  [2/7] customer: "Hi, I placed an order last week and I haven't received any..."
  ...

[STEP 5] Closing conversation...
  Conversation closed - this will trigger conversation_end operators

[STEP 6] Logged 2 webhook(s) received during conversation

  Webhook 1:
    Conversation: conv_conversation_01kj18tf08f9e9mjpvyyn4099r
    Intelligence Config: OperatorPlayground (v7)
    Operator Results: 1

    Result 1: NextAction (v2) (2.75 Seconds)
      ID: intelligence_operatorresult_01kj19rgsgegn8hbmgnzng898m
      Output Format: TEXT
      Trigger: COMMUNICATION at 2026-02-21T23:50:02.093855631Z
      Channels: VOICE
      Participants: 2
        - HUMAN_AGENT (conv_participant_01kj19r9kcf87sqp00a2ry1fpd)
        - CUSTOMER (conv_participant_01kj19r9brf2hs00m113j4nfsn)
      Result:
        {
          "text": "Look up the order and confirm the email address."
        }

[STEP 7] Waiting for operator result webhooks...
  (New webhooks will be logged in real-time)
  Press Ctrl-C to stop

[WEBHOOK 2] Received operator webhook:
  Conversation: conv_conversation_01kj19r964fe7a8szchez55bh8
  Intelligence Config: OperatorPlayground (v7)
  Operator Results: 1

    Result 1: ConversationSummary (v1) (3.12 Seconds)
      ID: intelligence_operatorresult_01kj19xtp67eqebkmp1mdb832x9
      Output Format: TEXT
      Trigger: conversation_end at 2026-02-21T23:51:30.000000000Z
      Channels: VOICE
      Participants: 2
        - HUMAN_AGENT (conv_participant_01kj19r9kcf87sqp00a2ry1fpd)
        - CUSTOMER (conv_participant_01kj19r9brf2hs00m113j4nfsn)
      Result:
        {
          "summary": "Customer inquired about order status..."
        }

^C (User presses Ctrl-C to exit)
```

## Troubleshooting

### No webhooks received

If you see "⚠️  No webhooks received", check:

1. **Is ngrok running?**
   ```bash
   ngrok http 3000
   ```

2. **Does the Intelligence Config webhook URL match your ngrok URL?**
   - Check in the Twilio Console
   - URL should be: `https://your-ngrok-url.ngrok.io/webhook/operator`

3. **Are operators configured correctly?**
   - Verify operators are added to the Intelligence Service Configuration
   - Check trigger settings (COMMUNICATION vs conversation_end)
   - Ensure webhook action is configured

4. **Check ngrok dashboard**
   - Open http://localhost:4040
   - Look for incoming webhook requests
   - Check for any errors

### Authentication errors

If you see authentication errors:
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in `.env`
- Ensure credentials are for the correct account
- Check that the Account SID starts with "AC"

### Configuration not found

If you see "Configuration not found":
- Verify `CONVERSATION_CONFIGURATION_ID` in `.env` is correct
- Ensure the configuration ID starts with `conv_configuration_`
- Check that the configuration exists in your account
- Ensure it's linked to an Intelligence Service Configuration

### Extract command errors

If you see "No conversation found with call SID":
- Verify the call SID is correct
- Ensure the conversation exists in your Maestro account
- Check that you're using the correct account credentials
- Note: Some call SIDs may have backend issues where conversations are not properly associated

If you see "No CUSTOMER participant found":
- The conversation must have at least one participant with type `CUSTOMER`
- Check participant types in the Maestro conversation

If you see "No HUMAN_AGENT participant found":
- The conversation must have at least one participant with type `HUMAN_AGENT`
- Check participant types in the Maestro conversation

## Architecture

```
┌─────────────────┐
│  Transcript     │
│  JSON Input     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  CLI Tool (Node.js/TypeScript)          │
│  ┌────────────────────────────────────┐ │
│  │ 1. Start Webhook Server (Express)  │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 2. Create Conversation + Parts     │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 3. Replay Messages (Buffer WHs)    │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 4. Close Conversation              │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 5. Log Buffered Webhooks           │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 6. Real-Time Webhook Logging       │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         │
         │ REST API
         │ (Create Communications)
         ▼
┌─────────────────┐         ┌──────────────────────────────┐
│  Maestro        │────────▶│  Conversational Intelligence │
│  Communications │  Events │  Operators                   │
│                 │         │  (Pre-configured)            │
└─────────────────┘         └──────┬───────────────────────┘
                                   │
                                   │ Webhook POST
                                   │ (Operator Results)
                                   ▼
                            ┌─────────────────┐
                            │  Ngrok Tunnel   │
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  CLI Webhook    │
                            │  Server         │
                            └─────────────────┘
```

## Development

### Run in development mode

```bash
npm run dev replay sample-transcripts/customer-service-call.json
```

### Build

```bash
npm run build
```

### Project Structure

```
cli/
├── package.json
├── tsconfig.json
├── .env.example
├── .env                         # User-created configuration
├── src/
│   ├── index.ts                 # Main CLI entry point
│   ├── config.ts                # Load .env configuration
│   ├── types.ts                 # TypeScript interfaces
│   ├── maestro-client.ts        # Maestro API client
│   ├── webhook-server.ts        # Express webhook server
│   ├── transcript-replayer.ts   # Orchestration logic
│   └── transcript-extractor.ts  # Extract conversations to transcripts
├── sample-transcripts/
│   └── customer-service-call.json
├── extracted-transcripts/       # Git-ignored extracted transcripts
│   └── .gitkeep
└── README.md
```

## Disclaimer

⚠️ **This is an unofficial tool and is NOT officially supported by Twilio.** Use at your own risk.

This tool is provided as-is for testing and development purposes. Bug reports and contributions are welcome!
