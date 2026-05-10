import { NextRequest, NextResponse } from 'next/server';
import { insertTranscript, listTranscripts } from '@/lib/db';
import type { Transcript } from '@/types';

export async function GET() {
  const transcripts = listTranscripts();
  return NextResponse.json(transcripts);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Transcript;

    if (!body.metadata?.name || !body.participants || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'Invalid transcript format' }, { status: 400 });
    }

    const transcript = insertTranscript(
      body.metadata.name,
      body.metadata.description ?? null,
      JSON.stringify(body)
    );

    return NextResponse.json(transcript, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}
