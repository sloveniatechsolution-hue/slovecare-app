module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
    '^react-native-video$': '<rootDir>/__mocks__/react-native-video.js',
    '^react-native-webview$': '<rootDir>/__mocks__/react-native-webview.js',
    '^@react-native-google-signin/google-signin$': '<rootDir>/__mocks__/google-signin.js',
    '^react-native-webrtc$': '<rootDir>/__mocks__/react-native-webrtc.js',
    '^react-native-incall-manager$': '<rootDir>/__mocks__/react-native-incall-manager.js',
    '^@react-native-voice/voice$': '<rootDir>/__mocks__/@react-native-voice/voice.js',
    '^react-native-tts$': '<rootDir>/__mocks__/react-native-tts.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|react-native-svg)/',
  ],
};
