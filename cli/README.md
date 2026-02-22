# Transcript Replay CLI Tool

A CLI tool that replays conversation transcripts through Maestro (Conversations Service) to trigger and test Conversational Intelligence operator webhooks.

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

```bash
npm start replay <transcript-file.json>
```

### Example

```bash
npm start replay sample-transcripts/customer-service-call.json
```

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
         │ Webhooks
         ▼
┌─────────────────┐         ┌──────────────────────────────┐
│  Maestro        │────────▶│  Conversational Intelligence │
│  Conversations  │  Events │  Operators                   │
│  Service        │         │  (Pre-configured)            │
└─────────────────┘         └──────┬───────────────────────┘
                                   │
                                   │ Webhook POST
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
│   └── transcript-replayer.ts   # Orchestration logic
├── sample-transcripts/
│   └── customer-service-call.json
└── README.md
```

## Disclaimer

⚠️ **This is an unofficial tool and is NOT officially supported by Twilio.** Use at your own risk.

This tool is provided as-is for testing and development purposes. Bug reports and contributions are welcome!
