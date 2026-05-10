import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conversation Intelligence Operator Playground',
  description: 'Test Conversation Intelligence operators with transcript simulations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-semibold text-gray-900 hover:text-blue-600">
              Operator Playground
            </Link>
            <Link href="/transcripts" className="text-sm text-gray-600 hover:text-blue-600">
              Transcripts
            </Link>
            <Link href="/simulated-calls" className="text-sm text-gray-600 hover:text-blue-600">
              Simulated Calls
            </Link>
            <Link href="/profiles" className="text-sm text-gray-600 hover:text-blue-600">
              Profiles
            </Link>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
