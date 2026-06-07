import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import RNFS, { CachesDirectoryPath, DocumentDirectoryPath } from 'react-native-fs';
import type { ReportData } from '../store/appStore';

export type MeetingRecord = {
  id: number;
  title: string;
  date: string;
  rawTranscript?: string;
  cleanedTranscript?: string;
  reports?: string; // JSON string: { "EN": { report, summary }, "FR": { report, summary } }
  audioPath?: string;
  createdAt?: string;
};

const DB_NAME = 'meeting_app.db';
const AUDIO_DIR = `${DocumentDirectoryPath}/meeting-audio`;

let db: DB | null = null;

function getDB(): DB {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

/**
 * Initialize the database: open connection, create tables, clean orphaned audio files.
 */
export async function initDB(): Promise<boolean> {
  if (db) {
    return true;
  }

  db = open({ name: DB_NAME });

  // Create tables
  db.executeSync(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      rawTranscript TEXT,
      cleanedTranscript TEXT,
      reports TEXT,
      audioPath TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Clean orphaned audio files
  await cleanOrphanedAudioFiles();

  return true;
}

/**
 * Save a new meeting record. Returns the auto-generated id.
 */
export async function saveMeeting(
  data: Omit<MeetingRecord, 'id'>,
): Promise<number> {
  const database = getDB();

  const result = await database.execute(
    `INSERT INTO meetings (title, date, rawTranscript, cleanedTranscript, reports, audioPath, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.date,
      data.rawTranscript ?? null,
      data.cleanedTranscript ?? null,
      data.reports ?? null,
      data.audioPath ?? null,
      data.createdAt ?? new Date().toISOString(),
    ],
  );

  const id = result.insertId;
  if (id === undefined || id === null) {
    throw new Error('Failed to save meeting: no insertId returned');
  }

  return id;
}

/**
 * Update an existing meeting record. Returns the updated record or null if not found.
 */
export async function updateMeeting(
  id: number,
  data: Partial<MeetingRecord>,
): Promise<MeetingRecord | null> {
  const database = getDB();

  // Build SET clause dynamically from provided fields
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    values.push(data.title);
  }
  if (data.date !== undefined) {
    fields.push('date = ?');
    values.push(data.date);
  }
  if (data.rawTranscript !== undefined) {
    fields.push('rawTranscript = ?');
    values.push(data.rawTranscript ?? null);
  }
  if (data.cleanedTranscript !== undefined) {
    fields.push('cleanedTranscript = ?');
    values.push(data.cleanedTranscript ?? null);
  }
  if (data.reports !== undefined) {
    fields.push('reports = ?');
    values.push(data.reports ?? null);
  }
  if (data.audioPath !== undefined) {
    fields.push('audioPath = ?');
    values.push(data.audioPath ?? null);
  }
  if (data.createdAt !== undefined) {
    fields.push('createdAt = ?');
    values.push(data.createdAt);
  }

  if (fields.length === 0) {
    return getMeeting(id);
  }

  values.push(id);

  await database.execute(
    `UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );

  return getMeeting(id);
}

/**
 * Get all meetings sorted by createdAt DESC.
 */
export async function getAllMeetings(): Promise<MeetingRecord[]> {
  const database = getDB();

  const result = await database.execute(
    'SELECT * FROM meetings ORDER BY createdAt DESC',
  );

  return result.rows.map(rowToMeetingRecord);
}

/**
 * Get a single meeting by id.
 */
export async function getMeeting(
  id: number,
): Promise<MeetingRecord | null> {
  const database = getDB();

  const result = await database.execute(
    'SELECT * FROM meetings WHERE id = ?',
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToMeetingRecord(result.rows[0]);
}

/**
 * Delete a meeting by id. Also deletes the associated audio directory if it exists.
 */
export async function deleteMeeting(id: number): Promise<boolean> {
  const database = getDB();

  // Get the meeting to find audioPath before deleting
  const meeting = await getMeeting(id);

  const result = await database.execute('DELETE FROM meetings WHERE id = ?', [
    id,
  ]);

  if (result.rowsAffected > 0 && meeting?.audioPath) {
    // Delete audio files associated with this meeting
    try {
      const audioDir = `${AUDIO_DIR}/${id}`;
      const exists = await RNFS.exists(audioDir);
      if (exists) {
        await RNFS.unlink(audioDir);
      }
    } catch {
      // Best-effort cleanup — don't fail the delete if audio cleanup fails
    }
  }

  return result.rowsAffected > 0;
}

/**
 * Get a setting value by key. Returns null if not found.
 */
export async function getSetting(key: string): Promise<string | null> {
  const database = getDB();

  const result = await database.execute(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].value as string;
}

/**
 * Set a setting value. Uses INSERT OR REPLACE to upsert.
 */
export async function setSetting(
  key: string,
  value: string,
): Promise<void> {
  const database = getDB();

  await database.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

/**
 * Get all settings as an array of { key, value } objects.
 */
export async function getAllSettings(): Promise<
  Array<{ key: string; value: string }>
> {
  const database = getDB();

  const result = await database.execute('SELECT key, value FROM settings');

  return result.rows.map((row: Record<string, Scalar>) => ({
    key: row.key as string,
    value: row.value as string,
  }));
}

/**
 * Delete all data from meetings and settings tables (keeps schema).
 * Also removes all audio files from the meeting-audio directory.
 */
export async function deleteAllData(): Promise<void> {
  const database = getDB();

  await database.execute('DELETE FROM meetings');
  await database.execute('DELETE FROM settings');

  // Remove all audio files
  try {
    const exists = await RNFS.exists(AUDIO_DIR);
    if (exists) {
      await RNFS.unlink(AUDIO_DIR);
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Move audio chunk files to a permanent location for a meeting.
 * Creates meeting-audio/{meetingId}/ and moves files from cache.
 * Returns the permanent directory path.
 */
export async function moveAudioToPermanentStorage(
  meetingId: number,
  chunkPaths: string[],
): Promise<string> {
  const meetingDir = `${AUDIO_DIR}/${meetingId}`;

  // Ensure the meeting audio directory exists
  const dirExists = await RNFS.exists(AUDIO_DIR);
  if (!dirExists) {
    await RNFS.mkdir(AUDIO_DIR);
  }

  const meetingDirExists = await RNFS.exists(meetingDir);
  if (!meetingDirExists) {
    await RNFS.mkdir(meetingDir);
  }

  // Move each chunk file to the permanent directory
  let firstFilePath: string | null = null;
  for (const chunkPath of chunkPaths) {
    const fileName = chunkPath.split('/').pop() || `chunk-${Date.now()}.m4a`;
    const destPath = `${meetingDir}/${fileName}`;

    const sourceExists = await RNFS.exists(chunkPath);
    if (sourceExists) {
      await RNFS.moveFile(chunkPath, destPath);
      if (firstFilePath === null) {
        firstFilePath = destPath;
      }
    }
  }

  if (!firstFilePath) {
    // No files were moved — scan the destination directory for any existing audio file
    const existingFiles = await RNFS.readDir(meetingDir).catch(() => []);
    const audioFile = existingFiles
      .filter((f) => f.isFile() && f.name.endsWith('.m4a'))
      .sort((a, b) => a.name.localeCompare(b.name))[0];

    if (!audioFile) {
      throw new Error(`No audio files found for meeting in ${meetingDir}`);
    }

    return audioFile.path;
  }

  return firstFilePath;
}

/**
 * Clean orphaned audio files from the meeting-audio/ directory.
 * Compares directories against existing meeting records' audioPath values.
 * Deletes any directory that doesn't correspond to a meeting record.
 */
async function cleanOrphanedAudioFiles(): Promise<void> {
  try {
    const audioDirExists = await RNFS.exists(AUDIO_DIR);
    if (!audioDirExists) {
      return;
    }

    // Get all meeting IDs that have audio paths
    const database = getDB();
    const result = await database.execute(
      "SELECT id FROM meetings WHERE audioPath IS NOT NULL AND audioPath != ''",
    );
    const validIds = new Set(result.rows.map((row) => String(row.id)));

    // Scan the meeting-audio directory
    const items = await RNFS.readDir(AUDIO_DIR);

    for (const item of items) {
      // Each subdirectory should be named with a meeting ID
      if (item.isDirectory() && !validIds.has(item.name)) {
        try {
          await RNFS.unlink(item.path);
        } catch {
          // Best-effort cleanup — skip if deletion fails
        }
      }
    }

    // Also clean orphaned temp files from cache directory
    await cleanCacheTempFiles();
  } catch {
    // Best-effort cleanup — don't fail DB init if cleanup fails
  }
}

/**
 * Clean up stale temp recording/chunk files from the cache directory.
 * These can be left behind if the app is killed during processing.
 */
async function cleanCacheTempFiles(): Promise<void> {
  try {
    const items = await RNFS.readDir(CachesDirectoryPath);

    for (const item of items) {
      if (
        item.name.startsWith('meeting-recording-') ||
        item.name.startsWith('chunks-') ||
        item.name.startsWith('upload-chunks-')
      ) {
        try {
          await RNFS.unlink(item.path);
        } catch {
          // Best-effort cleanup
        }
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Get the total number of meetings and audio storage size.
 */
export async function getStorageInfo(): Promise<{
  meetingCount: number;
  audioSizeMB: number;
}> {
  const database = getDB();

  const countResult = await database.execute('SELECT COUNT(*) as count FROM meetings');
  const meetingCount = (countResult.rows[0]?.count as number) ?? 0;

  let audioSizeBytes = 0;

  try {
    const audioDirExists = await RNFS.exists(AUDIO_DIR);
    if (audioDirExists) {
      const items = await RNFS.readDir(AUDIO_DIR);
      for (const item of items) {
        if (item.isDirectory()) {
          const subItems = await RNFS.readDir(item.path);
          for (const subItem of subItems) {
            if (subItem.isFile()) {
              audioSizeBytes += Number(subItem.size) || 0;
            }
          }
        }
      }
    }
  } catch {
    // If we can't read audio sizes, return 0
  }

  const audioSizeMB = Math.round((audioSizeBytes / (1024 * 1024)) * 10) / 10;

  return { meetingCount, audioSizeMB };
}

/**
 * Convert a database row to a MeetingRecord.
 */
function rowToMeetingRecord(
  row: Record<string, Scalar>,
): MeetingRecord {
  return {
    id: row.id as number,
    title: row.title as string,
    date: row.date as string,
    rawTranscript: (row.rawTranscript as string) || undefined,
    cleanedTranscript: (row.cleanedTranscript as string) || undefined,
    reports: (row.reports as string) || undefined,
    audioPath: (row.audioPath as string) || undefined,
    createdAt: (row.createdAt as string) || undefined,
  };
}

export type LangReport = {
  report: ReportData;
  summary: string[];
};

export type ParsedReports = {
  EN?: LangReport;
  FR?: LangReport;
};

export function parseReports(meeting: MeetingRecord): ParsedReports {
  const result: ParsedReports = {};
  if (!meeting.reports) return result;
  try {
    const parsed = JSON.parse(meeting.reports);
    if (parsed.EN) {
      result.EN = {
        report: parsed.EN.report ?? {},
        summary: Array.isArray(parsed.EN.summary) ? parsed.EN.summary : [],
      };
    }
    if (parsed.FR) {
      result.FR = {
        report: parsed.FR.report ?? {},
        summary: Array.isArray(parsed.FR.summary) ? parsed.FR.summary : [],
      };
    }
  } catch {
    // Ignore parse errors
  }
  return result;
}

export function getReportForLanguage(
  meeting: MeetingRecord,
  language: 'EN' | 'FR',
): LangReport | null {
  const parsed = parseReports(meeting);
  const langData = parsed[language];
  if (langData) return langData;
  if (parsed.EN) return parsed.EN;
  if (parsed.FR) return parsed.FR;
  return null;
}
