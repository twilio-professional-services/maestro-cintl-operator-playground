'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { TranscriptRow, Transcript, MemoraProfile } from '@/types';
import type { ConfiguredOperator } from '@/app/api/intelligence-config/route';

type TranscriptWithContent = TranscriptRow & { parsedContent?: Transcript };

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-green-100 text-green-800',
  negative: 'bg-red-100 text-red-800',
  neutral:  'bg-gray-100 text-gray-700',
  mixed:    'bg-yellow-100 text-yellow-800',
};

function SentimentBadge({ sentiment }: { sentiment: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${SENTIMENT_STYLES[sentiment] ?? 'bg-gray-100 text-gray-700'}`}>
      {sentiment}
    </span>
  );
}

const TRIGGER_LABELS: Record<string, string> = {
  COMMUNICATION: 'per message',
  CONVERSATION_END: 'on conversation end',
};

function profileLabel(p: MemoraProfile): string {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  return name ? `${name} — ${p.phone ?? p.id}` : (p.phone ?? p.id);
}

export default function TranscriptDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [row, setRow] = useState<TranscriptRow | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [operators, setOperators] = useState<ConfiguredOperator[]>([]);
  const [profiles, setProfiles] = useState<MemoraProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/transcripts/${params.id}`)
      .then((r) => r.json())
      .then((data: TranscriptWithContent) => {
        setRow(data);
        setTranscript(JSON.parse(data.content) as Transcript);
      })
      .catch(() => setError('Failed to load transcript'));

    fetch('/api/intelligence-config')
      .then((r) => r.json())
      .then((data: { operators: ConfiguredOperator[] }) => setOperators(data.operators))
      .catch(() => { /* non-fatal */ });

    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data: { profiles: MemoraProfile[] }) => setProfiles(data.profiles ?? []))
      .catch(() => { /* non-fatal */ });
  }, [params.id]);

  async function startSimulatedCall() {
    setStarting(true);
    setError(null);
    try {
      const selectedPhone = profiles.find((p) => p.id === selectedProfile)?.phone;
      const res = await fetch('/api/simulated-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptId: Number(params.id),
          ...(selectedPhone && { customerPhone: selectedPhone }),
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error: string };
        throw new Error(body.error);
      }
      const call = await res.json() as { id: number };
      router.push(`/simulated-calls/${call.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setStarting(false);
    }
  }

  if (!row) {
    return <div className="text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/transcripts" className="hover:text-blue-600">Transcripts</Link>
            <span>/</span>
            <span>{row.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{row.name}</h1>
            {transcript?.metadata.sentiment && (
              <SentimentBadge sentiment={transcript.metadata.sentiment} />
            )}
          </div>
          {row.description && <p className="text-gray-500 mt-1">{row.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {profiles.length > 0 && (
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Use transcript phone (default)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{profileLabel(p)}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => void startSimulatedCall()}
            disabled={starting}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Start Simulated Call'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {operators.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Operators that will run</h2>
          <div className="space-y-2">
            {operators.map((op) => (
              <div key={op.operatorId} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{op.displayName}</span>
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
                  {op.trigger.split(', ').map((t) => TRIGGER_LABELS[t] ?? t).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transcript && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Customer</p>
              <p>{selectedProfile ? (profiles.find((p) => p.id === selectedProfile)?.phone ?? transcript.participants.customer.address) : transcript.participants.customer.address}</p>
              <p className="text-gray-400 text-xs">{transcript.participants.customer.channel}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Agent</p>
              <p>{transcript.participants.agent.address}</p>
              <p className="text-gray-400 text-xs">{transcript.participants.agent.channel}</p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">
              Messages <span className="text-gray-400 font-normal text-sm">({transcript.messages.length})</span>
            </h2>
            <div className="space-y-2">
              {transcript.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'customer' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-xl px-4 py-2 rounded-2xl text-sm ${
                      msg.role === 'customer'
                        ? 'bg-white border border-gray-200'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <p className={`text-xs mb-1 font-medium ${msg.role === 'customer' ? 'text-gray-400' : 'text-blue-200'}`}>
                      {msg.role}
                    </p>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
