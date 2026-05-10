import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteSimulatedCalls } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { ids: number[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }
    bulkDeleteSimulatedCalls(body.ids);
    return NextResponse.json({ deleted: body.ids.length });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
