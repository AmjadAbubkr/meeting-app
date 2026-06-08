// Mock React Native's NativeModules and NativeEventEmitter
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Alert = { alert: jest.fn() };
  return RN;
});
