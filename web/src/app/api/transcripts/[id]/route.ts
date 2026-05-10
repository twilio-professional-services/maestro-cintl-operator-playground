import { NextRequest, NextResponse } from 'next/server';
import { getTranscript, deleteTranscript } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const transcript = getTranscript(Number(params.id));
  if (!transcript) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(transcript);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const transcript = getTranscript(Number(params.id));
  if (!transcript) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  deleteTranscript(Number(params.id));
  return new NextResponse(null, { status: 204 });
}
