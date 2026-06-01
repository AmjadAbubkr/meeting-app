import React from 'react';
import { View, Text } from 'react-native';

export function HistoryScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>History</Text>
      <Text>Meeting history list goes here.</Text>
    </View>
  );
}
