import { NextRequest, NextResponse } from 'next/server';
import { MEMORA_BASE, getMemoryStoreId, basicAuth } from '@/lib/memora';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { profileId: string } }
) {
  const storeId = await getMemoryStoreId();
  if (!storeId) {
    return NextResponse.json({ error: 'Memory Store not configured' }, { status: 422 });
  }

  const res = await fetch(
    `${MEMORA_BASE}/Stores/${storeId}/Profiles/${params.profileId}`,
    { method: 'DELETE', headers: { Authorization: basicAuth() }, cache: 'no-store' }
  );

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    return NextResponse.json({ error: `Memora ${res.status}: ${text}` }, { status: res.status });
  }

  return new NextResponse(null, { status: 204 });
}
