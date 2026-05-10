import { NextRequest, NextResponse } from 'next/server';
import { insertSimulatedCall, listSimulatedCalls, getTranscript } from '@/lib/db';
import { runReplay } from '@/lib/replay';
import type { Transcript } from '@/types';

export async function GET() {
  const calls = listSimulatedCalls();
  return NextResponse.json(calls);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { transcriptId: number; customerPhone?: string };

    if (!body.transcriptId) {
      return NextResponse.json({ error: 'transcriptId is required' }, { status: 400 });
    }

    const transcriptRow = getTranscript(body.transcriptId);
    if (!transcriptRow) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const call = insertSimulatedCall(body.transcriptId);
    const transcript = JSON.parse(transcriptRow.content) as Transcript;

    // Fire-and-forget — response returns immediately with the call ID
    void runReplay(transcript, call.id, body.customerPhone).catch((err) => {
      console.error(`[replay] simulated_call ${call.id} failed:`, err);
    });

    return NextResponse.json(call, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
