/**
 * @format
 *
 * Splash screen ka dark-mode render test — module-level `StyleSheet.create`
 * styles (feature chips, stats card, logo circle) dark mode me dark rehne
 * chahiye.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyTheme, colors } from '../src/theme/theme';
import SplashScreen from '../src/screens/SplashScreen';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    initializing: false,
    isLoggedIn: false,
    needsHealthProfile: false,
  }),
}));

const navigation = { replace: jest.fn(), navigate: jest.fn() } as never;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

function renderSplash() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      React.createElement(
        SafeAreaProvider,
        { initialMetrics: METRICS } as never,
        React.createElement(SplashScreen, { navigation, route: { params: {} } } as never),
      ),
    );
  });
  return renderer;
}

/** Rendered tree se sab background colours nikaal ke unique set. */
function backgrounds(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
  const found: string[] = [];
  renderer.root.findAll(node => node.props?.style != null).forEach(node => {
    const raw = node.props.style;
    const style = typeof raw === 'function' ? raw({ pressed: false }) : raw;
    const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined;
    if (!flat) return;
    const bg = flat.backgroundColor;
    if (typeof bg === 'string') found.push(bg);
  });
  return [...new Set(found)];
}

describe('SplashScreen — dark mode', () => {
  it('module-level styles bhi dark mode me dark surfaces paint karte hain', () => {
    applyTheme('dark');
    const renderer = renderSplash();
    const bgs = backgrounds(renderer);

    /* Card/chip surfaces dark honi chahiye. */
    expect(bgs).toContain(colors.card); // '#0F1725'
    expect(bgs).toContain(colors.cardMuted); // '#16202F'

    /* Light-mode surfaces light mode me bhi nahi rehni chahiye. */
    expect(bgs).not.toContain('#FFFFFF');
    expect(bgs).not.toContain('#F7F9FC');
  });

  it('light mode me sab surfaces light rehti hain', () => {
    applyTheme('light');
    const renderer = renderSplash();
    const bgs = backgrounds(renderer);

    expect(bgs).toContain(colors.card); // '#FFFFFF'
    expect(bgs).toContain(colors.cardMuted); // '#F7F9FC'
    expect(bgs).not.toContain('#0F1725');
    expect(bgs).not.toContain('#16202F');
  });
});
