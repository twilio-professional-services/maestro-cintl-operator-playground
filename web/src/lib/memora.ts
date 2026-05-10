export const MEMORA_BASE = 'https://memory.twilio.com/v1';

export function basicAuth(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

export async function getMemoryStoreId(): Promise<string | null> {
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

export async function memoraFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Memora ${res.status}: ${text}`);
  }
  // 202/204 responses may have no body
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function fetchAllPages<T>(url: string, key: string): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '100', orderBy: 'DESC' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await memoraFetch(`${url}?${params}`) as Record<string, unknown>;
    items.push(...((data[key] as T[]) ?? []));
    pageToken = (data.meta as { nextToken?: string } | undefined)?.nextToken;
  } while (pageToken);
  return items;
}
