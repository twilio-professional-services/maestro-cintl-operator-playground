'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Transcript, OperatorWebhookPayload, SimulatedCallRow, MemoryResult } from '@/types';
import type { ConfiguredOperator } from '@/app/api/intelligence-config/route';

interface OperatorResultEntry {
  id: number;
  simulated_call_id: number;
  conversation_id: string;
  payload: OperatorWebhookPayload;
  received_at: string;
}

interface CommunicationEntry {
  message_index: number;
  communication_id: string;
}

interface CallDetail extends SimulatedCallRow {
  transcript: Transcript | null;
  operatorResults: OperatorResultEntry[];
  communications: CommunicationEntry[];
}

export default function SimulatedCallDetailPage({ params }: { params: { id: string } }) {
  const [call, setCall] = useState<CallDetail | null>(null);
  const [results, setResults] = useState<OperatorResultEntry[]>([]);
  const [configuredOperators, setConfiguredOperators] = useState<ConfiguredOperator[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'operators' | 'memory'>('operators');
  const [memory, setMemory] = useState<MemoryResult | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [highlightedCommId, setHighlightedCommId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const resultCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    // Guard against the async race where the component unmounts before the
    // initial fetch resolves: without this, cleanup runs while esRef is still
    // null and the later openStream() leaks an EventSource on an unmounted
    // component that nothing ever closes.
    let cancelled = false;

    fetch(`/api/simulated-calls/${params.id}`)
      .then((r) => r.json())
      .then((data: CallDetail) => {
        if (cancelled) return;
        setCall(data);
        setResults(data.operatorResults);

        let maxId = 0;
        for (const entry of data.operatorResults) {
          if (entry.id > maxId) maxId = entry.id;
        }

        const messageCount = data.transcript?.messages?.length ?? 0;
        openStream(maxId, messageCount);
      })
      .catch(() => { if (!cancelled) setError('Failed to load call'); });

    fetch('/api/intelligence-config')
      .then((r) => r.json())
      .then((data: { operators: ConfiguredOperator[] }) => { if (!cancelled) setConfiguredOperators(data.operators); })
      .catch(() => { /* non-fatal */ });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function fetchMemory() {
    setMemoryLoading(true);
    try {
      const res = await fetch(`/api/simulated-calls/${params.id}/memory`);
      const data = await res.json() as MemoryResult;
      setMemory(data);
    } catch {
      setMemory({ observations: [], allObservations: [], summaries: [], error: 'Failed to load memory' });
    } finally {
      setMemoryLoading(false);
    }
  }

  function handleTabChange(tab: 'operators' | 'memory') {
    setActiveTab(tab);
    if (tab === 'memory' && memory === null) {
      void fetchMemory();
    }
  }

  function openStream(afterId: number, expectedMessageCount: number) {
    let knownCommCount = 0;
    const es = new EventSource(`/api/simulated-calls/${params.id}/stream?after=${afterId}`);
    esRef.current = es;

    es.onopen = () => setLive(true);

    es.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as
        | { type: 'operator_result'; data: OperatorResultEntry };

      if (msg.type === 'operator_result') {
        setResults((prev) =>
          prev.some((e) => e.id === msg.data.id) ? prev : [...prev, msg.data]
        );
        setLive(true);

        // Re-fetch call to pick up communications as replay progresses.
        // Per-communication operators can fire before replay finishes, so we
        // keep re-fetching until we have all expected communications.
        if (knownCommCount < expectedMessageCount) {
          fetch(`/api/simulated-calls/${params.id}`)
            .then((r) => r.json())
            .then((data: CallDetail) => {
              knownCommCount = data.communications?.length ?? 0;
              setCall(data);
            })
            .catch(() => { /* non-fatal */ });
        }
      }
    };

    // The browser's EventSource auto-reconnects on transient errors using this
    // same connection. Only reflect liveness here — do NOT open another
    // EventSource, or every error leaks a socket that keeps reconnecting on its
    // own, eventually exhausting Chrome's per-host connection limit and locking
    // up the tab. Re-delivered results are de-duped by id in onmessage above.
    es.onerror = () => setLive(false);
  }

  function handleTranscriptMessageClick(commId: string) {
    setHighlightedCommId((prev) => (prev === commId ? null : commId));
    resultCardRefs.current.get(commId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (error) return <div className="text-red-600">{error}</div>;
  if (!call) return <div className="text-gray-500">Loading…</div>;

  const transcript = call.transcript;

  const commMap = new Map<string, number>(
    (call.communications ?? []).map(({ communication_id, message_index }) => [communication_id, message_index])
  );
  const hasCommMap = commMap.size > 0;

  // Map from message_index to communication_id for the transcript bubble links
  const indexToCommId = new Map<number, string>(
    (call.communications ?? []).map(({ message_index, communication_id }) => [message_index, communication_id])
  );

  const allOpResults = results
    .flatMap((entry) =>
      entry.payload.operatorResults.map((opResult) => ({
        opResult,
        sortIndex: commMap.get(opResult.executionDetails?.communications?.last ?? '') ?? Infinity,
        receivedAt: entry.received_at,
      }))
    )
    .sort((a, b) =>
      a.sortIndex !== b.sortIndex
        ? a.sortIndex - b.sortIndex
        : a.receivedAt < b.receivedAt ? -1 : 1
    );

  const filteredOpResults = activeFilter
    ? allOpResults.filter(({ opResult }) => opResult.operator.id === activeFilter)
    : allOpResults;

  const seenOperatorIds = new Set(results.flatMap((e) => e.payload.operatorResults.map((o) => o.operator.id)));
  const filterChips = configuredOperators.filter((op) => seenOperatorIds.has(op.operatorId));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/simulated-calls" className="hover:text-blue-600">Simulated Calls</Link>
          <span>/</span>
          <span>#{call.id}</span>
        </div>
        <h1 className="text-2xl font-bold">Simulated Call #{call.id}</h1>
        {call.conversation_id && (
          <p className="text-xs text-gray-400 font-mono mt-1">conversation: {call.conversation_id}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Transcript messages */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Transcript</h2>
          {transcript ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {transcript.messages.map((msg, i) => {
                const commId = indexToCommId.get(i);
                const isCustomer = msg.role === 'customer';
                return (
                  <div key={i} className={`flex items-center gap-1 group ${isCustomer ? 'justify-start' : 'justify-end flex-row-reverse'}`}>
                    <div
                      className={`max-w-sm px-3 py-2 rounded-2xl text-sm ${
                        isCustomer ? 'bg-gray-100' : 'bg-blue-600 text-white'
                      }`}
                    >
                      <p className={`text-xs mb-0.5 font-medium ${isCustomer ? 'text-gray-400' : 'text-blue-200'}`}>
                        {msg.role}
                      </p>
                      {msg.text}
                    </div>
                    {hasCommMap && commId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTranscriptMessageClick(commId); }}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1 ${
                          highlightedCommId === commId ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'
                        }`}
                        title="Show related operator results"
                      >→</button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No transcript data.</p>
          )}
        </div>

        {/* Right: tabbed panel */}
        <div>
          {/* Tab bar */}
          <div className="flex items-center gap-1 mb-3 border-b border-gray-200">
            <button
              onClick={() => handleTabChange('operators')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'operators'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Operator Results
            </button>
            <button
              onClick={() => handleTabChange('memory')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'memory'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Customer Memory
            </button>
          </div>

          {activeTab === 'operators' && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-400">({filteredOpResults.length})</span>
                {live && results.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    live
                  </span>
                )}
              </div>

              {filterChips.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => setActiveFilter(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      activeFilter === null
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    All
                  </button>
                  {filterChips.map((op) => (
                    <button
                      key={op.operatorId}
                      onClick={() => setActiveFilter(activeFilter === op.operatorId ? null : op.operatorId)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        activeFilter === op.operatorId
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {op.displayName}
                    </button>
                  ))}
                </div>
              )}

              {filteredOpResults.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400 text-sm">
                  Waiting for operator results…
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {filteredOpResults.map(({ opResult }) => {
                    const lastCommId = opResult.executionDetails?.communications?.last;
                    return (
                      <OperatorResultCard
                        key={opResult.id}
                        result={opResult}
                        highlighted={!!lastCommId && highlightedCommId === lastCommId}
                        cardRef={(el) => {
                          if (lastCommId) {
                            if (el) resultCardRefs.current.set(lastCommId, el);
                            else resultCardRefs.current.delete(lastCommId);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'memory' && (
            <CustomerMemoryPanel
              memory={memory}
              loading={memoryLoading}
              onRefresh={() => void fetchMemory()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerMemoryPanel({
  memory,
  loading,
  onRefresh,
}: {
  memory: MemoryResult | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const observations = showAll ? (memory?.allObservations ?? []) : (memory?.observations ?? []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">
          {memory && !memory.unconfigured && !memory.error
            ? `${observations.length} observation${observations.length !== 1 ? 's' : ''}, ${memory.summaries.length} summar${memory.summaries.length !== 1 ? 'ies' : 'y'}`
            : ''}
        </span>
        <div className="flex items-center gap-2">
          {memory && !memory.unconfigured && !memory.error && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className={`text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                showAll
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {showAll ? 'This conversation only' : 'All conversations'}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50 border border-gray-200 rounded-lg px-3 py-1.5"
          >
            {loading && <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
            Refresh
          </button>
        </div>
      </div>

      {loading && !memory && (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400 text-sm">
          Loading memory…
        </div>
      )}

      {memory?.unconfigured && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Customer Memory is not configured. Ensure the Conversation Configuration has a linked Memory Store.
        </div>
      )}

      {memory?.error && !memory.unconfigured && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {memory.error}
        </div>
      )}

      {memory && !memory.unconfigured && !memory.error && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {memory.summaries.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Conversation Summary</h3>
              <div className="space-y-2">
                {memory.summaries.map((s) => (
                  <div key={s.id} className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-800">
                    <p>{s.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(s.occurredAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {observations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observations</h3>
              <div className="space-y-2">
                {observations.map((o) => (
                  <div key={o.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm">
                    <p className="text-gray-800">{o.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{o.source} · {new Date(o.occurredAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {observations.length === 0 && memory.summaries.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400 text-sm">
              No observations or summaries found for this conversation yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OperatorResultCard({
  result,
  highlighted = false,
  cardRef,
}: {
  result: OperatorWebhookPayload['operatorResults'][number];
  highlighted?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const latencyMs = result.metadata?.system?.latencyMs;
  const latencyLabel = latencyMs != null ? `${(latencyMs / 1000).toFixed(2)}s` : '—';

  return (
    <div
      ref={cardRef}
      className={`bg-white border rounded-lg overflow-hidden transition-all duration-300 ${
        highlighted ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
      >
        <div>
          <span className="font-medium text-sm">{result.operator.displayName}</span>
          <span className="text-xs text-gray-400 ml-2">v{result.operator.version}</span>
          <span className="text-xs text-gray-400 ml-2">· {result.outputFormat}</span>
          <span className="text-xs text-gray-400 ml-2">· trigger: {result.executionDetails.trigger.on}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{latencyLabel}</span>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <pre className="text-xs text-gray-700 overflow-auto max-h-64 whitespace-pre-wrap break-all">
            {JSON.stringify(result.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
