export type MeetingRecord = {
  id: number;
  title: string;
  date: string;
  rawTranscript?: string;
  cleanedTranscript?: string;
  reportEN?: string;
  reportFR?: string;
  summaryEN?: string;
  summaryFR?: string;
  createdAt?: string;
};

const meetings = new Map<number, MeetingRecord>();
let nextId = 1;

export async function initDB() {
  return true;
}

export async function saveMeeting(data: Omit<MeetingRecord, 'id'>) {
  const id = nextId++;
  meetings.set(id, { id, ...data });
  return id;
}

export async function updateMeeting(id: number, data: Partial<MeetingRecord>) {
  const existing = meetings.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...data };
  meetings.set(id, updated);
  return updated;
}

export async function getAllMeetings() {
  return Array.from(meetings.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function getMeeting(id: number) {
  return meetings.get(id) || null;
}
