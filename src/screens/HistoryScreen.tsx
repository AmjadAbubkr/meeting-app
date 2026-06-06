import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, Text, TextInput, View, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenShell } from '../components/ScreenShell';
import { getAllMeetings, MeetingRecord } from '../db/database';

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

type Section = {
  title: DateGroup;
  data: MeetingRecord[];
};

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = new Date(dateStr);
  const meetingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor(
    (today.getTime() - meetingDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return 'This Week';
  return 'Earlier';
}

function groupMeetingsByDate(meetings: MeetingRecord[]): Section[] {
  const groups: Record<DateGroup, MeetingRecord[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: [],
  };

  for (const meeting of meetings) {
    const createdAt = meeting.createdAt || meeting.date || '';
    const group = getDateGroup(createdAt);
    groups[group].push(meeting);
  }

  const order: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  return order
    .filter((title) => groups[title].length > 0)
    .map((title) => ({ title, data: groups[title] }));
}

function getSubtitle(meeting: MeetingRecord): string {
  // Try to extract an overview from the reports JSON
  if (meeting.reports) {
    try {
      const parsed = JSON.parse(meeting.reports);
      // Check EN first, then FR
      const langData = parsed.EN || parsed.FR;
      if (langData?.report?.overview) {
        const overview = langData.report.overview as string;
        return overview.length > 80 ? overview.substring(0, 80) + '...' : overview;
      }
      // Try summary bullets
      const summary = langData?.summary;
      if (Array.isArray(summary) && summary.length > 0) {
        const first = summary[0] as string;
        return first.length > 80 ? first.substring(0, 80) + '...' : first;
      }
    } catch {
      // Ignore parse errors
    }
  }
  if (meeting.cleanedTranscript) {
    const text = meeting.cleanedTranscript.trim();
    return text.length > 80 ? text.substring(0, 80) + '...' : text;
  }
  return 'No report yet';
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function HistoryScreen({ navigation }: any) {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [searchText, setSearchText] = useState('');

  useFocusEffect(
    useCallback(() => {
      getAllMeetings().then(setMeetings);
    }, []),
  );

  const filteredMeetings = useMemo(() => {
    if (!searchText.trim()) return meetings;
    const query = searchText.toLowerCase();
    return meetings.filter((m) => m.title.toLowerCase().includes(query));
  }, [meetings, searchText]);

  const sections = useMemo(
    () => groupMeetingsByDate(filteredMeetings),
    [filteredMeetings],
  );

  return (
    <ScreenShell>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>History</Text>

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search meetings..."
          placeholderTextColor="#8a7e72"
          style={styles.searchInput}
        />

        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchText ? 'No meetings match your search.' : 'No meetings recorded yet.'}
            </Text>
          }
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionTitle}>{title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('MeetingDetail', { meetingId: item.id })
              }
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDate}>
                {formatDate(item.createdAt || item.date)}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                {getSubtitle(item)}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  headerTitle: {
    color: '#e8d5b7',
    fontSize: 28,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: '#141414',
    color: '#f5f0eb',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.15)',
  },
  sectionTitle: {
    color: '#8a7e72',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    backgroundColor: 'rgba(26,26,26,0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.15)',
  },
  cardTitle: {
    color: '#e8d5b7',
    fontSize: 18,
    fontWeight: '600',
  },
  cardDate: {
    color: '#8a7e72',
    fontSize: 13,
    marginTop: 2,
  },
  cardSubtitle: {
    color: '#8a7e72',
    fontSize: 14,
    marginTop: 4,
  },
  emptyText: {
    color: '#8a7e72',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
