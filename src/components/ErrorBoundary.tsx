import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: string | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error}</Text>
          <Pressable onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    padding: 24,
  },
  title: {
    color: '#f5f0eb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    color: '#8a7e72',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retry: {
    color: '#d4a574',
    fontSize: 16,
    fontWeight: '600',
  },
});
