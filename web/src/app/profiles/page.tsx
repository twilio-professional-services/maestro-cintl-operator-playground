'use client';

import { useState, useEffect } from 'react';
import type { MemoraProfile } from '@/types';

interface ProfilesResponse {
  profiles: MemoraProfile[];
  unconfigured?: boolean;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<MemoraProfile[]>([]);
  const [unconfigured, setUnconfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Per-row action state
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [clearResults, setClearResults] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json() as ProfilesResponse;
      setProfiles(data.profiles ?? []);
      setUnconfigured(data.unconfigured ?? false);
    } catch {
      setError('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate() {
    if (!phone.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json() as { error: string };
        throw new Error(body.error);
      }
      setPhone('');
      setFirstName('');
      setLastName('');
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setCreating(false);
    }
  }

  async function handleClearMemory(profileId: string) {
    setClearingId(profileId);
    setClearResults((prev) => ({ ...prev, [profileId]: '' }));
    try {
      const res = await fetch(`/api/profiles/${profileId}/clear-memory`, { method: 'POST' });
      const body = await res.json() as { deleted?: { observations: number; summaries: number }; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Failed');
      const { observations, summaries } = body.deleted ?? { observations: 0, summaries: 0 };
      setClearResults((prev) => ({
        ...prev,
        [profileId]: `Deleted ${observations} observation${observations !== 1 ? 's' : ''} and ${summaries} summar${summaries !== 1 ? 'ies' : 'y'}`,
      }));
    } catch (err) {
      setClearResults((prev) => ({
        ...prev,
        [profileId]: err instanceof Error ? err.message : 'Failed',
      }));
    } finally {
      setClearingId(null);
    }
  }

  async function handleDelete(profileId: string) {
    if (!confirm('Delete this profile permanently? This cannot be undone.')) return;
    setDeletingId(profileId);
    try {
      await fetch(`/api/profiles/${profileId}`, { method: 'DELETE' });
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profiles</h1>
        <p className="text-gray-500 mt-1">Manage Conversation Memory customer profiles used in simulated calls.</p>
      </div>

      {unconfigured && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Customer Memory is not configured. Ensure the Conversation Configuration has a linked Memory Store.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Create profile form */}
      {!unconfigured && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Create Profile</h2>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+14155550001"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              />
            </div>
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !phone.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
          {createError && (
            <p className="text-red-600 text-xs mt-2">{createError}</p>
          )}
        </div>
      )}

      {/* Profiles table */}
      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : profiles.length === 0 && !unconfigured ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500">
          <p>No profiles yet.</p>
          <p className="text-sm mt-1">Create a profile above to get started.</p>
        </div>
      ) : profiles.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Profile ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{p.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs" title={p.id}>
                    {p.id.slice(0, 30)}…
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {clearResults[p.id] && (
                        <span className="text-xs text-green-700">{clearResults[p.id]}</span>
                      )}
                      <button
                        onClick={() => void handleClearMemory(p.id)}
                        disabled={clearingId === p.id}
                        className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 disabled:opacity-50"
                      >
                        {clearingId === p.id ? 'Clearing…' : 'Clear Memory'}
                      </button>
                      <button
                        onClick={() => void handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
