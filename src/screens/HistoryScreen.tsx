import { useCallback, useMemo, useState } from 'react';
import { SectionList, Text, TextInput, View, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenShell } from '../components/ScreenShell';
import { getAllMeetings, getReportForLanguage, MeetingRecord } from '../db/database';

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
  const langData = getReportForLanguage(meeting, 'EN');
  if (langData?.report?.overview) {
    const overview = langData.report.overview;
    return overview.length > 80 ? overview.substring(0, 80) + '...' : overview;
  }
  // Try summary bullets
  if (langData?.summary.length) {
    const first = langData.summary[0];
    return first.length > 80 ? first.substring(0, 80) + '...' : first;
  }
  if (meeting.rawTranscript) {
    const text = meeting.rawTranscript.trim();
    if (text === '') return 'No report yet';
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

function MeetingListItem({
  meeting,
  onPress,
}: {
  meeting: MeetingRecord;
  onPress: (id: number) => void;
}) {
  return (
    <Pressable onPress={() => onPress(meeting.id)} style={styles.card}>
      <Text style={styles.cardTitle}>{meeting.title}</Text>
      <Text style={styles.cardDate}>
        {formatDate(meeting.createdAt || meeting.date)}
      </Text>
      <Text style={styles.cardSubtitle} numberOfLines={2}>
        {getSubtitle(meeting)}
      </Text>
    </Pressable>
  );
}

export function HistoryScreen({ navigation, noSafeArea }: any) {
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

  const handleMeetingPress = useCallback(
    (meetingId: number) => navigation.navigate('MeetingDetail', { meetingId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: MeetingRecord }) => (
      <MeetingListItem meeting={item} onPress={handleMeetingPress} />
    ),
    [handleMeetingPress],
  );

  return (
    <ScreenShell noSafeArea={noSafeArea}>
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
          renderItem={renderItem}
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
