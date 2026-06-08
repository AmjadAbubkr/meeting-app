import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  noPadding?: boolean;
  noSafeArea?: boolean;
};

export function ScreenShell({ children, noPadding, noSafeArea }: Props) {
  const insets = useSafeAreaInsets();

  if (noSafeArea) {
    return (
      <View
        style={[
          styles.container,
          noPadding && styles.noPadding,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <StatusBar barStyle="light-content" />
        {children}
      </View>
    );
  }

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
