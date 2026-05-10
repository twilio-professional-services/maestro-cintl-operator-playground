'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { TranscriptRow } from '@/types';

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/transcripts');
    const data = await res.json() as TranscriptRow[];
    setTranscripts(data);
  }

  useEffect(() => { void load(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      if (!res.ok) {
        const body = await res.json() as { error: string };
        throw new Error(body.error);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this transcript?')) return;
    await fetch(`/api/transcripts/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transcripts</h1>
          <p className="text-gray-500 mt-1">Upload or generate transcripts to use in simulated calls.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            Generate with AI
          </button>
          <label className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading ? 'Uploading…' : 'Upload JSON'}
            <input type="file" accept=".json" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {transcripts.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500">
          <p>No transcripts yet.</p>
          <p className="text-sm mt-1">Upload a JSON file or generate one with AI.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transcripts.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/transcripts/${t.id}`} className="text-blue-600 hover:underline font-medium">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.description ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t.created_at + 'Z').toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void handleDelete(t.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGenerateModal && (
        <GenerateModal
          onClose={() => setShowGenerateModal(false)}
          onGenerated={() => { setShowGenerateModal(false); void load(); }}
        />
      )}
    </div>
  );
}

const SENTIMENT_OPTIONS = [
  { value: 'positive', label: 'Positive', active: 'bg-green-100 text-green-800 border-green-300', inactive: 'border-gray-200 text-gray-600 hover:bg-gray-50' },
  { value: 'negative', label: 'Negative', active: 'bg-red-100 text-red-800 border-red-300', inactive: 'border-gray-200 text-gray-600 hover:bg-gray-50' },
  { value: 'neutral',  label: 'Neutral',  active: 'bg-gray-200 text-gray-800 border-gray-400', inactive: 'border-gray-200 text-gray-600 hover:bg-gray-50' },
  { value: 'mixed',   label: 'Mixed',    active: 'bg-yellow-100 text-yellow-800 border-yellow-300', inactive: 'border-gray-200 text-gray-600 hover:bg-gray-50' },
] as const;

function GenerateModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: () => void }) {
  const [scenario, setScenario] = useState('');
  const [testGoal, setTestGoal] = useState('');
  const [messageCount, setMessageCount] = useState(12);
  const [sentiment, setSentiment] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  async function handleGenerate() {
    if (!scenario.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/transcripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, testGoal, messageCount, ...(sentiment && { sentiment }) }),
      });
      if (!res.ok) {
        const body = await res.json() as { error: string };
        throw new Error(body.error);
      }
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generate Transcript with AI</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Call scenario
            </label>
            <textarea
              ref={textareaRef}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g. Customer calls about a flat tire on a remote highway and needs roadside assistance"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What we are trying to test
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={testGoal}
              onChange={(e) => setTestGoal(e.target.value)}
              placeholder="e.g. Operator should detect high urgency, service category = Roadside, and customer mentions their location"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of messages <span className="text-gray-400 font-normal">({messageCount})</span>
            </label>
            <input
              type="range"
              min={4}
              max={40}
              step={2}
              value={messageCount}
              onChange={(e) => setMessageCount(Number(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>4 — short</span>
              <span>20 — medium</span>
              <span>40 — long</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sentiment
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <div className="flex gap-2">
              {SENTIMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSentiment(sentiment === opt.value ? '' : opt.value)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${sentiment === opt.value ? opt.active : opt.inactive}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleGenerate()}
            disabled={generating || !scenario.trim()}
            className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generating && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
