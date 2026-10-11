/**
 * @format
 */

/* Native modules jest me exist nahi karte — AIScreen import karte hi voice.ts
   inhe chhod ke crash hoti hai. Isliye inhe halke mocks se replace karte hain. */
jest.mock('@react-native-voice/voice', () => ({
  __esModule: true,
  default: {
    onSpeechStart: null,
    onSpeechPartialResults: null,
    onSpeechResults: null,
    onSpeechEnd: null,
    onSpeechError: null,
    start: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    cancel: jest.fn(() => Promise.resolve()),
    destroy: jest.fn(() => Promise.resolve()),
    removeAllListeners: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    setDefaultRate: jest.fn(() => Promise.resolve()),
    setDefaultLanguage: jest.fn(() => Promise.resolve()),
    speak: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

/* eslint-disable import/first */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AIScreen from '../src/screens/AIScreen';

test('AIScreen renders without crashing', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider>
        <AIScreen />
      </SafeAreaProvider>,
    );
  });
  expect(tree).toBeTruthy();
});
