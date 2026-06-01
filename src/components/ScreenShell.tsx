import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

export function ScreenShell({ children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1220' },
  container: { flex: 1, backgroundColor: '#0b1220', padding: 20 },
});
