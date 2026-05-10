'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

import type { SimulatedCallRow } from '@/types';

type CallRow = SimulatedCallRow & { transcript_name: string };

export default function SimulatedCallsPage() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const res = await fetch('/api/simulated-calls');
    const data = await res.json() as CallRow[];
    setCalls(data);
    setSelected(new Set());
  }

  useEffect(() => { void load(); }, []);

  const allSelected = calls.length > 0 && selected.size === calls.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(calls.map((c) => c.id)));
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteOne(id: number) {
    if (!confirm('Delete this simulated call?')) return;
    setDeleting(true);
    await fetch(`/api/simulated-calls/${id}`, { method: 'DELETE' });
    setDeleting(false);
    await load();
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} simulated call${selected.size > 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    await fetch('/api/simulated-calls/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setDeleting(false);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Simulated Calls</h1>
          <p className="text-gray-500 mt-1">Each call replays a transcript through Conversation Intelligence and collects operator results.</p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => void deleteSelected()}
            disabled={deleting}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : `Delete ${selected.size} selected`}
          </button>
        )}
      </div>

      {calls.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500">
          <p>No simulated calls yet.</p>
          <Link href="/transcripts" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Start one from a transcript
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Transcript</th>

                <th className="text-left px-4 py-3 font-medium text-gray-500">Conversation ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Started</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 ${selected.has(c.id) ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/simulated-calls/${c.id}`} className="text-blue-600 hover:underline font-mono">
                      #{c.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.transcript_name ?? '—'}</td>

                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.conversation_id ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.created_at + 'Z').toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void deleteOne(c.id)}
                      disabled={deleting}
                      className="text-red-500 hover:text-red-700 text-xs disabled:opacity-40"
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
    </div>
  );
}
