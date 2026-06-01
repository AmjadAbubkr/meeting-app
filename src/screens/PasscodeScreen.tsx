import React from 'react';
import { View, Text, Button } from 'react-native';

export function PasscodeScreen({ navigation }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 12 }}>Meeting App</Text>
      <Text style={{ marginBottom: 24 }}>Passcode setup/entry screen goes here.</Text>
      <Button title="Enter App" onPress={() => navigation.replace('Main')} />
    </View>
  );
}
