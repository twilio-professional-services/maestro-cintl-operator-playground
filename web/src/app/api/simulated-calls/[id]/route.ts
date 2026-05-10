import { NextRequest, NextResponse } from 'next/server';
import { getSimulatedCall, listOperatorResults, getTranscript, deleteSimulatedCall } from '@/lib/db';
import type { Transcript } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const call = getSimulatedCall(Number(params.id));
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const operatorResults = listOperatorResults(call.id);
  const transcriptRow = call.transcript_id ? getTranscript(call.transcript_id) : null;
  const transcript = transcriptRow ? (JSON.parse(transcriptRow.content) as Transcript) : null;

  return NextResponse.json({
    ...call,
    transcript,
    operatorResults: operatorResults.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload),
    })),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const call = getSimulatedCall(Number(params.id));
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteSimulatedCall(Number(params.id));
  return new NextResponse(null, { status: 204 });
}
