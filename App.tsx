/**
 * SloveCare — Android app entry point.
 * Providers → Navigation → Animated Splash.
 */


import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider, useThemePreference } from './src/theme/ThemeContext';

function AppContent(): React.JSX.Element {
  const { dark, themeKey } = useThemePreference();
  return (
    <>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {/* Theme badalte hi cached native card styles ke saath poora UI refresh. */}
      <RootNavigator key={themeKey} />
    </>
  );
}

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider><AppContent /></AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
