import { NextRequest, NextResponse } from 'next/server';
import { getSimulatedCallByConversationId, insertOperatorResult } from '@/lib/db';
import type { OperatorWebhookPayload } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as OperatorWebhookPayload;

    if (!payload.conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    const call = getSimulatedCallByConversationId(payload.conversationId);
    if (!call) {
      return NextResponse.json({ received: true });
    }

    payload.receivedAt = new Date().toISOString();
    insertOperatorResult(call.id, payload.conversationId, JSON.stringify(payload));

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
