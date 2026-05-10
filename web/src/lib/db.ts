import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { TranscriptRow, SimulatedCallRow, OperatorResultRow } from '@/types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'playground.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS simulated_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id INTEGER REFERENCES transcripts(id),
      conversation_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operator_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulated_call_id INTEGER REFERENCES simulated_calls(id),
      conversation_id TEXT,
      payload TEXT NOT NULL,
      received_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return _db;
}

// Transcript helpers
export function insertTranscript(name: string, description: string | null, content: string): TranscriptRow {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO transcripts (name, description, content) VALUES (?, ?, ?)'
  );
  const result = stmt.run(name, description, content);
  return getTranscript(result.lastInsertRowid as number)!;
}

export function listTranscripts(): TranscriptRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM transcripts ORDER BY created_at DESC').all() as TranscriptRow[];
}

export function getTranscript(id: number): TranscriptRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM transcripts WHERE id = ?').get(id) as TranscriptRow) ?? null;
}

export function deleteTranscript(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM transcripts WHERE id = ?').run(id);
}

// Simulated call helpers
export function insertSimulatedCall(transcriptId: number): SimulatedCallRow {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO simulated_calls (transcript_id) VALUES (?)'
  );
  const result = stmt.run(transcriptId);
  return getSimulatedCall(result.lastInsertRowid as number)!;
}

export function updateSimulatedCall(
  id: number,
  fields: Partial<Pick<SimulatedCallRow, 'conversation_id'>>
): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (fields.conversation_id !== undefined) {
    sets.push('conversation_id = ?');
    values.push(fields.conversation_id);
  }
  values.push(id);
  db.prepare(`UPDATE simulated_calls SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function listSimulatedCalls(): (SimulatedCallRow & { transcript_name: string })[] {
  const db = getDb();
  return db.prepare(`
    SELECT sc.*, t.name AS transcript_name
    FROM simulated_calls sc
    LEFT JOIN transcripts t ON t.id = sc.transcript_id
    ORDER BY sc.created_at DESC
  `).all() as (SimulatedCallRow & { transcript_name: string })[];
}

export function getSimulatedCall(id: number): SimulatedCallRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM simulated_calls WHERE id = ?').get(id) as SimulatedCallRow) ?? null;
}

export function getSimulatedCallByConversationId(conversationId: string): SimulatedCallRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM simulated_calls WHERE conversation_id = ?').get(conversationId) as SimulatedCallRow) ?? null;
}

// Operator result helpers
export function insertOperatorResult(
  simulatedCallId: number,
  conversationId: string,
  payload: string
): OperatorResultRow {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO operator_results (simulated_call_id, conversation_id, payload) VALUES (?, ?, ?)'
  );
  const result = stmt.run(simulatedCallId, conversationId, payload);
  return getOperatorResult(result.lastInsertRowid as number)!;
}

export function getOperatorResult(id: number): OperatorResultRow | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM operator_results WHERE id = ?').get(id) as OperatorResultRow) ?? null;
}

export function listOperatorResults(simulatedCallId: number): OperatorResultRow[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM operator_results WHERE simulated_call_id = ? ORDER BY received_at ASC'
  ).all(simulatedCallId) as OperatorResultRow[];
}

export function listOperatorResultsSince(simulatedCallId: number, afterId: number): OperatorResultRow[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM operator_results WHERE simulated_call_id = ? AND id > ? ORDER BY received_at ASC'
  ).all(simulatedCallId, afterId) as OperatorResultRow[];
}

export function deleteSimulatedCall(id: number): void {
  const db = getDb();
  const del = db.transaction(() => {
    db.prepare('DELETE FROM operator_results WHERE simulated_call_id = ?').run(id);
    db.prepare('DELETE FROM simulated_calls WHERE id = ?').run(id);
  });
  del();
}

export function bulkDeleteSimulatedCalls(ids: number[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const del = db.transaction(() => {
    db.prepare(`DELETE FROM operator_results WHERE simulated_call_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM simulated_calls WHERE id IN (${placeholders})`).run(...ids);
  });
  del();
}
