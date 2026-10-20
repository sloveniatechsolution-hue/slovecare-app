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
import PrescriptionReaderPlansScreen from '../screens/PrescriptionReaderPlansScreen';
import PrescriptionDetailScreen from '../screens/PrescriptionDetailScreen';
import DietPlannerLandingScreen from '../screens/DietPlannerLandingScreen';
import DietPlannerScreen from '../screens/DietPlannerScreen';
import DietPlanResultScreen from '../screens/DietPlanResultScreen';
import ConsultationBookScreen from '../screens/ConsultationBookScreen';
import MyConsultationsScreen from '../screens/MyConsultationsScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import TabNavigator from './TabNavigator';
import { RootStackParamList } from './types';
import { colors } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.JSX.Element {
  const { dark } = useThemePreference();
  const navTheme = {
    ...DefaultTheme,
    dark,
    colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.blue, card: colors.card, text: colors.text, border: colors.border },
  };
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
        <Stack.Screen name="PrescriptionReaderPlans" component={PrescriptionReaderPlansScreen} />
        <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
        <Stack.Screen name="DietPlannerLanding" component={DietPlannerLandingScreen} />
        <Stack.Screen name="DietPlanner" component={DietPlannerScreen} />
        <Stack.Screen name="DietPlanResult" component={DietPlanResultScreen} />
        <Stack.Screen name="ConsultationBook" component={ConsultationBookScreen} />
        <Stack.Screen name="MyConsultations" component={MyConsultationsScreen} />
        <Stack.Screen name="VideoCall" component={VideoCallScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
