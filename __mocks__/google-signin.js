/**
 * @react-native-google-signin/google-signin — native TurboModule test
 * environment me nahi milta. Sirf wahi methods mock kiye hain jo app use
 * karta hai (configure / hasPlayServices / signIn / signOut).
 */
const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(() => Promise.resolve(true)),
  signIn: jest.fn(() => Promise.resolve({ idToken: 'mock-id-token' })),
  signInWithWebClient: jest.fn(() => Promise.resolve({ idToken: 'mock-id-token' })),
  getTokens: jest.fn(() => Promise.resolve({ idToken: 'mock-id-token', accessToken: 'mock-access' })),
  isSignedIn: jest.fn(() => Promise.resolve(false)),
  signOut: jest.fn(() => Promise.resolve()),
  revokeAccess: jest.fn(() => Promise.resolve()),
  getCurrentUser: jest.fn(() => Promise.resolve(null)),
};

const statusCodes = {
  SIGN_IN_CANCELLED: 12501,
  SIGN_IN_REQUIRED: 12502,
  IN_PROGRESS: 12503,
  PLAY_SERVICES_NOT_AVAILABLE: 12504,
};

module.exports = { GoogleSignin, statusCodes };
