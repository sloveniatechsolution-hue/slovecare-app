/**
 * Root stack — Splash → Auth → HealthProfile → Main (tabs) + detail screens.
 */

import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import HealthProfileScreen from '../screens/HealthProfileScreen';
import DoctorDetailScreen from '../screens/DoctorDetailScreen';
import BookingScreen from '../screens/BookingScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import EmergencyScreen from '../screens/EmergencyScreen';
import LabReportsScreen from '../screens/LabReportsScreen';
import ServicesScreen from '../screens/ServicesScreen';
import PrescriptionReaderScreen from '../screens/PrescriptionReaderScreen';
import TabNavigator from './TabNavigator';
import { RootStackParamList } from './types';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.blue,
    card: colors.card,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="HealthProfile" component={HealthProfileScreen} />
        <Stack.Screen name="Main" component={TabNavigator} options={{ animation: 'fade' }} />
        <Stack.Screen name="DoctorDetail" component={DoctorDetailScreen} />
        <Stack.Screen name="Booking" component={BookingScreen} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="LabReports" component={LabReportsScreen} />
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="PrescriptionReader" component={PrescriptionReaderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
