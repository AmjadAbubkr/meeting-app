import React from 'react';
import { View, Text, Button } from 'react-native';
import { useAppStore } from '../store/appStore';

export function MeetingScreen() {
  const appState = useAppStore((state) => state.appState);
  const meetingTitle = useAppStore((state) => state.meetingTitle);

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>Meeting</Text>
      <Text style={{ marginBottom: 16 }}>State: {appState}</Text>
      <Text style={{ marginBottom: 24 }}>Title: {meetingTitle || 'No meeting yet'}</Text>
      <Button title="Placeholder action" onPress={() => {}} />
    </View>
  );
}
