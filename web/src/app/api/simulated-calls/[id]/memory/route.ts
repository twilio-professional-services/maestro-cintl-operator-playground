import { NextRequest, NextResponse } from 'next/server';
import { getSimulatedCall, listOperatorResults, getTranscript } from '@/lib/db';
import type { Transcript, MemoryObservation, MemorySummary, MemoryResult } from '@/types';

const MEMORA_BASE = 'https://memory.twilio.com/v1';

function basicAuth(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

async function memoraGet(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Memora ${res.status}: ${body}`);
  }
  return res.json();
}

async function memoraPost(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memora ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchAllObservations(storeId: string, profileId: string): Promise<MemoryObservation[]> {
  const items: MemoryObservation[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '100', orderBy: 'DESC' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await memoraGet(
      `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/Observations?${params}`
    ) as { observations: MemoryObservation[]; meta?: { nextToken?: string } };
    items.push(...(data.observations ?? []));
    pageToken = data.meta?.nextToken;
  } while (pageToken);
  return items;
}

async function fetchAllSummaries(storeId: string, profileId: string): Promise<MemorySummary[]> {
  const items: MemorySummary[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '100', orderBy: 'DESC' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await memoraGet(
      `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/ConversationSummaries?${params}`
    ) as { summaries: MemorySummary[]; meta?: { nextToken?: string } };
    items.push(...(data.summaries ?? []));
    pageToken = data.meta?.nextToken;
  } while (pageToken);
  return items;
}

async function getMemoryStoreId(): Promise<string | null> {
  const convConfigId = process.env.CONVERSATION_CONFIGURATION_ID;
  if (!convConfigId) return null;
  try {
    const res = await fetch(
      `https://conversations.twilio.com/v2/ControlPlane/Configurations/${convConfigId}`,
      { headers: { Authorization: basicAuth() }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json() as { memoryStoreId?: string };
    return data.memoryStoreId ?? null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const empty: MemoryResult = { observations: [], allObservations: [], summaries: [] };

  const storeId = await getMemoryStoreId();
  if (!storeId) {
    return NextResponse.json({ ...empty, unconfigured: true });
  }

  const call = getSimulatedCall(Number(params.id));
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const conversationId = call.conversation_id;
  if (!conversationId) {
    return NextResponse.json({ ...empty, error: 'No conversation ID on this call' });
  }

  // Resolve profileId from stored operator webhook payloads
  const operatorResults = listOperatorResults(call.id);
  let profileId: string | null = null;

  for (const row of operatorResults) {
    try {
      const payload = JSON.parse(row.payload) as {
        operatorResults: Array<{
          executionDetails: { participants: Array<{ type: string; profileId: string | null }> };
        }>;
      };
      for (const op of payload.operatorResults) {
        const customer = op.executionDetails.participants.find((p) => p.type === 'CUSTOMER');
        if (customer?.profileId) {
          profileId = customer.profileId;
          break;
        }
      }
    } catch { /* skip malformed */ }
    if (profileId) break;
  }

  // Fallback: lookup by customer phone from transcript
  if (!profileId && call.transcript_id) {
    const transcriptRow = getTranscript(call.transcript_id);
    if (transcriptRow) {
      const transcript = JSON.parse(transcriptRow.content) as Transcript;
      const phone = transcript.participants.customer.address;
      try {
        const data = await memoraPost(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/Lookup`,
          { idType: 'phone', value: phone }
        ) as { profiles?: string[] };
        profileId = data.profiles?.[0] ?? null;
      } catch { /* lookup failed, continue */ }
    }
  }

  if (!profileId) {
    return NextResponse.json({ ...empty, error: 'Could not resolve customer profile' });
  }

  try {
    const [allObservations, allSummaries] = await Promise.all([
      fetchAllObservations(storeId, profileId),
      fetchAllSummaries(storeId, profileId),
    ]);

    const observations = allObservations.filter((o) =>
      Array.isArray(o.conversationIds) && o.conversationIds.includes(conversationId)
    );
    const summaries = allSummaries.filter((s) => s.conversationId === conversationId);

    return NextResponse.json({ observations, allObservations, summaries, profileId } satisfies MemoryResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ...empty, error: message });
  }
}
