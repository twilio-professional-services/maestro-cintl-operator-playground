import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface ConfiguredOperator {
  operatorId: string;
  displayName: string;
  trigger: string;
}

interface IntelligenceRule {
  id: string;
  operators: Array<{ id: string; version: number | null; parameters: unknown }>;
  triggers: Array<{ on: string; parameters: unknown }>;
  actions: Array<{ type: string; url: string; method: string }>;
}

interface IntelligenceConfig {
  id: string;
  displayName: string;
  rules: IntelligenceRule[];
}

interface OperatorDetail {
  id: string;
  displayName: string;
}

async function fetchWithBasicAuth(url: string): Promise<Response> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return fetch(url, {
    cache: 'no-store',
    headers: {
      Authorization: `Basic ${credentials}`,
      'X-Pre-Auth-Context': accountSid,
    },
  });
}

async function getIntelligenceConfigIds(): Promise<string[]> {
  const convConfigId = process.env.CONVERSATION_CONFIGURATION_ID;
  if (!convConfigId) return [];

  const res = await fetchWithBasicAuth(
    `https://conversations.twilio.com/v2/ControlPlane/Configurations/${convConfigId}`
  );
  if (!res.ok) return [];

  const data = await res.json() as { intelligenceConfigurationIds?: string[] };
  return data.intelligenceConfigurationIds ?? [];
}

async function getIntelligenceConfig(configId: string): Promise<IntelligenceConfig | null> {
  const res = await fetchWithBasicAuth(
    `https://intelligence.twilio.com/v3/ControlPlane/Configurations/${configId}`
  );
  if (!res.ok) return null;
  return res.json() as Promise<IntelligenceConfig>;
}

async function getOperatorName(operatorId: string): Promise<string> {
  const res = await fetchWithBasicAuth(
    `https://intelligence.twilio.com/v3/ControlPlane/Operators/${operatorId}`
  );
  if (!res.ok) return operatorId;
  const data = await res.json() as OperatorDetail;
  return data.displayName ?? operatorId;
}

export async function GET() {
  try {
    const intelConfigIds = await getIntelligenceConfigIds();
    if (intelConfigIds.length === 0) {
      return NextResponse.json({ operators: [] });
    }

    const configs = await Promise.all(intelConfigIds.map(getIntelligenceConfig));

    // Collect unique operator IDs and their triggers across all rules
    const operatorTriggers = new Map<string, Set<string>>();
    for (const config of configs) {
      if (!config) continue;
      for (const rule of config.rules) {
        const trigger = rule.triggers[0]?.on ?? 'UNKNOWN';
        for (const op of rule.operators) {
          const existing = operatorTriggers.get(op.id) ?? new Set<string>();
          existing.add(trigger);
          operatorTriggers.set(op.id, existing);
        }
      }
    }

    // Resolve display names in parallel
    const operatorIds = Array.from(operatorTriggers.keys());
    const names = await Promise.all(operatorIds.map(getOperatorName));

    const operators: ConfiguredOperator[] = operatorIds.map((id, i) => ({
      operatorId: id,
      displayName: names[i],
      trigger: Array.from(operatorTriggers.get(id)!).join(', '),
    }));

    return NextResponse.json({ operators });
  } catch (err) {
    console.error('[intelligence-config]', err);
    return NextResponse.json({ operators: [] });
  }
}
