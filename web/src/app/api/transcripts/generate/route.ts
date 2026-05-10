import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { insertTranscript } from '@/lib/db';
import type { Transcript } from '@/types';

const SENTIMENT_RULES: Record<string, string> = {
  positive: 'The overall tone must be positive — the customer is calm and satisfied, the issue is resolved smoothly, and the call ends on a happy note.',
  negative: 'The overall tone must be negative — the customer is frustrated, upset, or angry throughout; the issue may not be fully resolved and the customer leaves dissatisfied.',
  neutral: 'The overall tone must be neutral — the customer is matter-of-fact, neither particularly pleased nor upset, and the conversation is businesslike.',
  mixed: 'The overall tone must be mixed — the customer starts frustrated or worried but gradually becomes more satisfied as the agent helps resolve the issue.',
};

function buildSystemPrompt(sentiment?: string): string {
  const sentimentField = sentiment
    ? `; sentiment: "${sentiment}"`
    : '; sentiment?: "positive" | "negative" | "neutral" | "mixed"';
  const sentimentRule = sentiment ? `\n- ${SENTIMENT_RULES[sentiment]}` : '';

  return `You are generating realistic customer service call transcripts in JSON format.

The transcript must strictly follow this TypeScript type:
{
  metadata: { name: string; description: string${sentimentField} };
  participants: {
    customer: { address: string; channel: "SMS" | "VOICE" | "EMAIL" };
    agent: { address: string; channel: "SMS" | "VOICE" | "EMAIL" };
  };
  messages: Array<{ role: "customer" | "agent"; text: string }>;
}

Rules:
- Use +10000000000 as the customer address for VOICE/SMS (it will be overridden at replay time by the selected profile phone); use a realistic phone for the agent (e.g. +14155550001); use emails for EMAIL
- customer and agent must use the same channel
- Make the conversation feel natural — include greetings, clarifications, and resolution
- The name should be a short title (e.g. "Billing dispute — overcharge")
- The description should be one sentence summarising the call${sentimentRule}
- Return ONLY valid JSON, no markdown fences, no extra text`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const body = await request.json() as { scenario?: string; testGoal?: string; description?: string; messageCount: number; sentiment?: string };

    const callReason = (body.scenario ?? body.description ?? '').trim();
    if (!callReason) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const messageCount = Math.min(Math.max(Number(body.messageCount) || 10, 4), 40);
    const sentiment = body.sentiment && SENTIMENT_RULES[body.sentiment] ? body.sentiment : undefined;

    const client = new OpenAI({ apiKey });

    const testGoalInstruction = body.testGoal?.trim() ? `\nWhat to test: ${body.testGoal.trim()}` : '';
    const sentimentInstruction = sentiment ? `\nRequired sentiment: ${sentiment}` : '';

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(sentiment) },
        {
          role: 'user',
          content: `Generate a customer service call transcript.\n\nCall reason: ${callReason}\nNumber of messages: ${messageCount}${testGoalInstruction}${sentimentInstruction}\n\nReturn a JSON object with exactly these top-level keys: metadata, participants, messages.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'Empty response from OpenAI' }, { status: 502 });
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // gpt-4o-mini sometimes wraps the result in a top-level key — unwrap if needed
    const transcript = (
      parsed.metadata && parsed.participants && parsed.messages
        ? parsed
        : Object.values(parsed).find(
            (v) =>
              typeof v === 'object' &&
              v !== null &&
              'metadata' in v &&
              'participants' in v &&
              'messages' in v
          )
    ) as Transcript | undefined;

    if (!transcript?.metadata?.name || !transcript.participants || !Array.isArray(transcript.messages)) {
      console.error('[generate] unexpected shape from OpenAI:', raw);
      return NextResponse.json({ error: 'OpenAI returned an invalid transcript structure' }, { status: 502 });
    }

    const row = insertTranscript(
      transcript.metadata.name,
      transcript.metadata.description ?? null,
      JSON.stringify(transcript)
    );

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
