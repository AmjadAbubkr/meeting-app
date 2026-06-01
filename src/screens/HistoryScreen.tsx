import React, { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { getAllMeetings, MeetingRecord } from '../db/database';

export function HistoryScreen() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);

  useEffect(() => {
    getAllMeetings().then(setMeetings);
  }, []);

  return (
    <ScreenShell>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '800', marginBottom: 16 }}>History</Text>
      <FlatList
        data={meetings}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={{ color: '#94a3b8' }}>No meetings recorded yet.</Text>}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#111827', borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: '#94a3b8' }}>{item.date}</Text>
          </View>
        )}
      />
    </ScreenShell>
  );
}
