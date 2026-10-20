/**
 * SloveCare — Android app entry point.
 * Providers → Navigation → Animated Splash.
 */


import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { PrescriptionCreditsProvider } from './src/context/PrescriptionCreditsContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider, useThemePreference } from './src/theme/ThemeContext';

function AppContent(): React.JSX.Element {
  const { dark } = useThemePreference();
  return (
    <>
      {/*
        Status bar app ke theme ko follow karta hai. Background app ka hi
        hai (edge-to-edge), sirf icon ka colour badalta hai.
      */}
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {/*
        ⚠️ Pehle yahan `key={themeKey}` tha — theme switch par poora navigator
        remount ho jaata tha (user Splash par wapas chala jaata tha, video call
        / chat / form state khatam ho jaati thi). Ab colour mapping EXACT hai,
        is liye theme normal re-render se propagate hota hai aur navigation
        state bachi rehti hai.
      */}
      <RootNavigator />
    </>
  );
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          {/* Prescription Reader credits (3 free → ₹19 / 10 reads) app-wide. */}
          <PrescriptionCreditsProvider><AppContent /></PrescriptionCreditsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
