import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PasscodeScreen } from '../screens/PasscodeScreen';
import { ApiKeySetupScreen } from '../screens/ApiKeySetupScreen';
import { MeetingScreen } from '../screens/MeetingScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MeetingDetailScreen } from '../screens/MeetingDetailScreen';
import { hasPasscode } from '../services/passcode';
import { hasApiKey } from '../services/apiKeys';
import { useAppStore } from '../store/appStore';

const Stack = createNativeStackNavigator();

function TopNavBar({ active, onNavigate }: { active: string; onNavigate: (screen: string) => void }) {
  const insets = useSafeAreaInsets();
  const links = ['Meeting', 'History', 'Settings'];

  return (
    <View style={[styles.navBar, { paddingTop: insets.top }]}>
      <View style={styles.navContent}>
        <Text style={styles.navBrand}>Meeting</Text>
        <View style={styles.navLinks}>
          {links.map((link) => (
            <Pressable
              key={link}
              onPress={() => onNavigate(link)}
              style={[styles.navLink, active === link && styles.navLinkActive]}
            >
              <Text style={[styles.navLinkText, active === link && styles.navLinkTextActive]}>
                {link}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function MainScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState('Meeting');

  const handleNavigate = (screen: string) => {
    setActiveTab(screen);
  };

  useEffect(() => {
    const subscription = navigation.addListener('beforeRemove', (e: any) => {
      if (navigation.getState().index === 0) {
        e.preventDefault();
      }
    });
    return subscription;
  }, [navigation]);

  return (
    <View style={styles.mainContainer}>
      <TopNavBar active={activeTab} onNavigate={handleNavigate} />
      <View style={styles.screenContainer}>
        {activeTab === 'Meeting' && <MeetingScreen navigation={navigation} noSafeArea />}
        {activeTab === 'History' && <HistoryScreen navigation={navigation} noSafeArea />}
        {activeTab === 'Settings' && <SettingsScreen navigation={navigation} noSafeArea />}
      </View>
    </View>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#d4a574" />
    </View>
  );
}

export function AppNavigator() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const [passcodeExists, setPasscodeExists] = useState<boolean | null>(null);
  const [initialRoute, setInitialRoute] = useState<'ApiKeySetup' | 'Main' | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const exists = await hasPasscode();
        setPasscodeExists(exists);

        // Always resolve initialRoute — even when a passcode exists.
        // After the user authenticates, gateRoute needs initialRoute to
        // determine the next screen. Without this, initialRoute stays null
        // and the loading guard traps the user forever.
        const hasGroq = await hasApiKey('groq');
        const hasGemini = await hasApiKey('gemini');
        setInitialRoute(hasGroq && hasGemini ? 'Main' : 'ApiKeySetup');
      } catch {
        setInitialRoute('ApiKeySetup');
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  if (!isReady || passcodeExists === null || initialRoute === null) {
    return <LoadingScreen />;
  }

  let gateRoute: 'Passcode' | 'ApiKeySetup' | 'Main';

  if (passcodeExists && !isAuthenticated) {
    gateRoute = 'Passcode';
  } else {
    gateRoute = initialRoute;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={gateRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Passcode" component={PasscodeScreen} />
        <Stack.Screen name="ApiKeySetup" component={ApiKeySetupScreen} />
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen
          name="MeetingDetail"
          component={MeetingDetailScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  navBar: {
    backgroundColor: 'rgba(15,15,15,0.9)',
    borderBottomColor: 'rgba(212,165,116,0.15)',
    borderBottomWidth: 1,
  },
  navContent: {
    height: 54,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navBrand: {
    fontSize: 20,
    fontWeight: '700',
    color: '#d4a574',
    letterSpacing: 0.5,
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navLink: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  navLinkActive: {
    backgroundColor: 'rgba(212,165,116,0.1)',
  },
  navLinkText: {
    color: '#8a7e72',
    fontSize: 15,
    fontWeight: '500',
  },
  navLinkTextActive: {
    color: '#d4a574',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  screenContainer: {
    flex: 1,
  },
});
