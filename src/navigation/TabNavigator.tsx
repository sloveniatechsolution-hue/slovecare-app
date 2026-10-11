/**
 * Bottom tab navigator — Home, Doctors, Labs, Slota AI, Profile.
 * Floating white bar + gradient slide pill (icon aur label dono cover karta hai),
 * spring icon pop, label colour crossfade — sab RN Animated se, koi extra lib nahi.
 * Slota AI tab par ek pyaari si SVG billi (CatIcon) hai jo focus par wiggle karti hai.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import Icon, { IconName } from '../components/Icon';
import CatIcon from '../components/CatIcon';
import HomeScreen from '../screens/HomeScreen';
import DoctorsScreen from '../screens/DoctorsScreen';
import LabTestsScreen from '../screens/LabTestsScreen';
import AIScreen from '../screens/AIScreen';
/* Medicines segment disabled — Pharmacy tab ki jagah AI tab hai.
import PharmacyScreen from '../screens/PharmacyScreen';
*/
import ProfileScreen from '../screens/ProfileScreen';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemeKey, useThemePreference } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator();

const PILL_INSET = 5;
const PILL_HEIGHT = 46;
const PILL_TOP = 3;

interface TabMeta {
  label: string;
  icon: IconName;
  /** AI tab — icon ki jagah SVG billi (CatIcon) dikhti hai. */
  cat?: boolean;
}

const TAB_META: Record<string, TabMeta> = {
  Home: { label: 'Home', icon: 'home' },
  Doctors: { label: 'Doctors', icon: 'stethoscope' },
  Labs: { label: 'Labs', icon: 'flask' },
  AI: { label: 'Slota AI', icon: 'sparkles', cat: true },
  Profile: { label: 'Profile', icon: 'user' },
  /* purana tab (ab disabled) */
  Pharmacy: { label: 'Pharmacy', icon: 'pill' },
};

/** Pill ka brand gradient (teal → azure) — unique id taaki SVG ids clash na karein. */
function PillGradient(): React.JSX.Element {
  const gradientId = `tab-pill-${useId().replace(/:/g, '')}`;
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.blue} />
        </SvgGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={PILL_HEIGHT / 2} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

/** Ek tab — focus hote hi icon spring-pop, label ka rang fade-in, cat wiggle. */
function TabItem({
  meta,
  focused,
  onPress,
  onLongPress,
}: {
  meta: TabMeta;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}): React.JSX.Element {
  /* 0 = inactive, 1 = active — iske saare animations nikalte hain. */
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;
  /* Billi ka hilne-wala animation. */
  const wiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(active, {
      toValue: focused ? 1 : 0,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [active, focused]);

  /* Slota AI focused ho to billi thodi si hile — thoda mazedar feel. */
  useEffect(() => {
    if (!focused || !meta.cat) {
      wiggle.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 300, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [focused, meta.cat, wiggle]);

  const scale = active.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const lift = active.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const tint = active.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const wiggleRotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
    >
      <Animated.View
        style={[styles.iconWrap, { transform: [{ scale }, { translateY: lift }, { rotate: wiggleRotate }] }]}
      >
        {/* Cat tab — colorful animated billi; baaki tabs grey→white crossfade */}
        {meta.cat ? (
          <CatIcon size={20} />
        ) : (
          <>
            <Icon name={meta.icon} size={18} color={colors.textSecondary} strokeWidth={1.9} />
            <Animated.View style={[styles.iconActive, { opacity: tint }]}>
              <Icon name={meta.icon} size={19} color={colors.textInverse} strokeWidth={2.4} />
            </Animated.View>
          </>
        )}
      </Animated.View>

      <View style={styles.labelWrap}>
        <Text numberOfLines={1} style={styles.label}>
          {meta.label}
        </Text>
        <Animated.Text
          numberOfLines={1}
          style={[styles.label, styles.labelActive, { opacity: tint }]}
        >
          {meta.label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

function TabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const themeKey = useThemeKey();
  const [rowWidth, setRowWidth] = useState(0);

  const tabWidth = rowWidth > 0 ? rowWidth / state.routes.length : 0;
  const pillWidth = Math.max(tabWidth - PILL_INSET * 2, 0);

  /* Focused index par chalti hui continuous value — pill isi se slide karta hai. */
  const progress = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: state.index,
      friction: 9,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [progress, state.index]);

  const translateX = progress.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => i * tabWidth + PILL_INSET),
    extrapolate: 'clamp',
  });

  /* Tab bar ke bahar koi aur themed view nahi hai, is liye yahan bhi wahi
     themeKey remount lagta hai — warna tab bar ke colours (stable stylesheet
     references) purane hi reh jaate the. */
  return (
    <React.Fragment key={themeKey}>
      <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 6) }]}>
        <View style={styles.bar}>
          <View style={styles.row} onLayout={event => setRowWidth(event.nativeEvent.layout.width)}>
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, { width: pillWidth, transform: [{ translateX }] }]}
            >
              <PillGradient />
            </Animated.View>
            {state.routes.map((route, index) => {
              const meta = TAB_META[route.name] ?? { label: route.name, icon: 'grid' as IconName };
              const focused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  // Keep the nested screen state intact while switching tabs. Using
                  // the route key here makes this work consistently from every tab.
                  navigation.navigate({ name: route.name, params: route.params, merge: true } as never);
                }
              };

              const onLongPress = () => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              };

              return (
                <TabItem
                  key={route.key}
                  meta={meta}
                  focused={focused}
                  onPress={onPress}
                  onLongPress={onLongPress}
                />
              );
            })}
          </View>
        </View>
      </View>
    </React.Fragment>
  );
}

export default function TabNavigator(): React.JSX.Element {
  useThemePreference();
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Doctors" component={DoctorsScreen} />
      <Tab.Screen name="Labs" component={LabTestsScreen} />
      {/* Medicines segment disabled — Pharmacy tab ki jagah Slota AI assistant tab */}
      {/* <Tab.Screen name="Pharmacy" component={PharmacyScreen} /> */}
      <Tab.Screen name="AI" component={AIScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: 2,
  },
  bar: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: 4,
    ...shadow.float,
  },
  row: { flexDirection: 'row' },
  pill: {
    position: 'absolute',
    left: 0,
    top: PILL_TOP,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: colors.primaryDark,
    overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  tabItem: {
    flex: 1,
    minHeight: 52,
    paddingTop: 5,
    paddingBottom: 5,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    borderRadius: radius.lg,
  },
  tabItemPressed: { backgroundColor: colors.cardMuted },
  iconWrap: { width: 44, height: 26, alignItems: 'center', justifyContent: 'center' },
  iconActive: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: { alignSelf: 'stretch', alignItems: 'center' },
  label: { ...typography.caption, fontSize: 10.5, color: colors.textSecondary, textAlign: 'center' },
  labelActive: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    color: colors.textInverse,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
