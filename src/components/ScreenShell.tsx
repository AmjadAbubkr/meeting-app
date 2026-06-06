import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  noPadding?: boolean;
};

export function ScreenShell({ children, noPadding }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.container, noPadding && styles.noPadding]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f0f' },
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 20 },
  noPadding: { padding: 0 },
});
