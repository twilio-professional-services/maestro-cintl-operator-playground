import { NextRequest, NextResponse } from 'next/server';
import { MEMORA_BASE, getMemoryStoreId, basicAuth, fetchAllPages } from '@/lib/memora';

async function deleteItem(url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: basicAuth() },
    cache: 'no-store',
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Memora ${res.status}: ${text}`);
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { profileId: string } }
) {
  const storeId = await getMemoryStoreId();
  if (!storeId) {
    return NextResponse.json({ error: 'Memory Store not configured' }, { status: 422 });
  }

  const { profileId } = params;
  const base = `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}`;

  const [observations, summaries] = await Promise.all([
    fetchAllPages<{ id: string }>(`${base}/Observations`, 'observations'),
    fetchAllPages<{ id: string }>(`${base}/ConversationSummaries`, 'summaries'),
  ]);

  await Promise.all([
    ...observations.map((o) => deleteItem(`${base}/Observations/${o.id}`)),
    ...summaries.map((s) => deleteItem(`${base}/ConversationSummaries/${s.id}`)),
  ]);

  return NextResponse.json({ deleted: { observations: observations.length, summaries: summaries.length } });
}
