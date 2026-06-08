import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, PermissionsAndroid, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDB } from './src/db/database';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
      } catch {
        // initDB failure — continue to render AppNavigator which handles fallback routing
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setPermissionGranted(true);
        setIsReady(true);
      } else {
        Alert.alert(
          'Permission Required',
          'Microphone permission is required to record meetings.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Exit', onPress: () => BackHandler.exitApp() },
          ],
        );
      }
    })();
  }, []);

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
