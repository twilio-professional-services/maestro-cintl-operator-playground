import { NextRequest, NextResponse } from 'next/server';
import { MEMORA_BASE, basicAuth, getMemoryStoreId, memoraFetch } from '@/lib/memora';
import type { MemoraProfile } from '@/types';

interface RawProfile {
  id: string;
  createdAt?: string;
  traits?: {
    Contact?: {
      phone?: string;
      firstName?: string;
      lastName?: string;
    };
  };
}

async function fetchProfileWithTraits(storeId: string, profileId: string): Promise<MemoraProfile> {
  try {
    const data = await memoraFetch(
      `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}?traitGroups=Contact`
    ) as RawProfile;
    return {
      id: profileId,
      phone: data.traits?.Contact?.phone,
      firstName: data.traits?.Contact?.firstName,
      lastName: data.traits?.Contact?.lastName,
      createdAt: data.createdAt,
    };
  } catch {
    return { id: profileId };
  }
}

export async function GET() {
  const storeId = await getMemoryStoreId();
  if (!storeId) {
    return NextResponse.json({ profiles: [], unconfigured: true });
  }

  // List profile IDs (paginated)
  const profileIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '50', orderBy: 'DESC' });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${MEMORA_BASE}/Stores/${storeId}/Profiles?${params}`, {
      headers: { Authorization: basicAuth() },
      cache: 'no-store',
    });
    if (!res.ok) break;
    const data = await res.json() as { profiles: string[]; meta?: { nextToken?: string } };
    profileIds.push(...(data.profiles ?? []));
    pageToken = data.meta?.nextToken;
  } while (pageToken);

  // Fetch traits for all profiles in parallel
  const profiles = await Promise.all(
    profileIds.map((id) => fetchProfileWithTraits(storeId, id))
  );

  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const storeId = await getMemoryStoreId();
  if (!storeId) {
    return NextResponse.json({ error: 'Memory Store not configured' }, { status: 422 });
  }

  const body = await request.json() as { phone?: string; firstName?: string; lastName?: string };
  if (!body.phone?.trim()) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  const contact: Record<string, string> = { phone: body.phone.trim() };
  if (body.firstName?.trim()) contact.firstName = body.firstName.trim();
  if (body.lastName?.trim()) contact.lastName = body.lastName.trim();

  const data = await memoraFetch(`${MEMORA_BASE}/Stores/${storeId}/Profiles`, {
    method: 'POST',
    body: JSON.stringify({ traits: { Contact: contact } }),
  }) as { id: string; message: string };

  return NextResponse.json(data, { status: 201 });
}
