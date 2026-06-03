import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PasscodeScreen } from './src/screens/PasscodeScreen';
import { ApiKeySetupScreen } from './src/screens/ApiKeySetupScreen';
import { MeetingScreen } from './src/screens/MeetingScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MeetingDetailScreen } from './src/screens/MeetingDetailScreen';
import { hasPasscode } from './src/services/passcode';
import { hasApiKey } from './src/services/apiKeys';
import { initDB } from './src/db/database';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Meeting"
    >
      <Tab.Screen
        name="Meeting"
        component={MeetingScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>{'\uD83C\uDF99'}</Text>,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>{'\uD83D\uDCCB'}</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>{'\u2699'}</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Loading screen shown while checking auth state on app launch.
 */
function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#f59e0b" />
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'Passcode' | 'ApiKeySetup' | 'Main'>('Passcode');

  // Determine initial route based on auth state
  useEffect(() => {
    (async () => {
      // Initialize database first
      await initDB();

      const passcodeExists = await hasPasscode();

      if (!passcodeExists) {
        setInitialRoute('Passcode');
        setIsReady(true);
        return;
      }

      // Passcode exists — check API keys
      const hasGroq = await hasApiKey('groq');
      const hasGemini = await hasApiKey('gemini');

      if (!hasGroq || !hasGemini) {
        setInitialRoute('ApiKeySetup');
      } else {
        setInitialRoute('Main');
      }

      setIsReady(true);
    })();
  }, []);

  if (!isReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <LoadingScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Passcode" component={PasscodeScreen} />
            <Stack.Screen name="ApiKeySetup" component={ApiKeySetupScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="MeetingDetail"
              component={MeetingDetailScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
