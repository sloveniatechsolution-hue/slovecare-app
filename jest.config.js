module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
    '^react-native-video$': '<rootDir>/__mocks__/react-native-video.js',
    '^react-native-webview$': '<rootDir>/__mocks__/react-native-webview.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|react-native-svg)/',
  ],
};
