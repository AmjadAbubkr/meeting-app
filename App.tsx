import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, PermissionsAndroid, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDB } from './src/db/database';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestPermission = useCallback(async () => {
    setPermissionDenied(false);

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setIsReady(true);
        return;
      }
    } catch {
      // Show the retry state below when the native permission request fails.
    }

    setPermissionDenied(true);
    Alert.alert(
      'Permission Required',
      'Microphone permission is required to record meetings.',
      [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Retry', style: 'cancel' },
        { text: 'Exit', onPress: () => BackHandler.exitApp() },
      ],
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
      } catch {
        // initDB failure — continue to render AppNavigator which handles fallback routing
      }

      await requestPermission();
    })();
  }, [requestPermission]);

  if (permissionDenied) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 }}>
            <Text style={{ color: '#f5f0eb', fontSize: 18, textAlign: 'center' }}>
              Microphone permission is required to record meetings.
            </Text>
            <Pressable onPress={requestPermission} style={{ backgroundColor: '#d4a574', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 14 }}>
              <Text style={{ color: '#0f0f0f', fontWeight: '700' }}>Try Again</Text>
            </Pressable>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!isReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#d4a574" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
