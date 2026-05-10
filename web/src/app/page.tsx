import Link from 'next/link';
import { listTranscripts, listSimulatedCalls } from '@/lib/db';
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const transcripts = listTranscripts();
  const calls = listSimulatedCalls();
  const recentCalls = calls.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Replay transcripts through Conversation Intelligence and inspect operator results.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Transcripts" value={transcripts.length} href="/transcripts" />
        <StatCard label="Simulated Calls" value={calls.length} href="/simulated-calls" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Simulated Calls</h2>
          <Link href="/simulated-calls" className="text-sm text-blue-600 hover:underline">View all</Link>
        </div>
        {recentCalls.length === 0 ? (
          <EmptyState
            message="No simulated calls yet."
            action={{ label: 'Start one from a transcript', href: '/transcripts' }}
          />
        ) : (
          <CallTable calls={recentCalls} />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </Link>
  );
}

function CallTable({ calls }: { calls: ReturnType<typeof listSimulatedCalls> }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Transcript</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Started</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {calls.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link href={`/simulated-calls/${c.id}`} className="text-blue-600 hover:underline">
                  {c.transcript_name ?? 'Unknown'}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: { label: string; href: string } }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500">
      <p>{message}</p>
      {action && (
        <Link href={action.href} className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'Z').toLocaleString();
}
