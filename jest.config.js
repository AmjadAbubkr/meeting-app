module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js|jsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|zustand)/)',
  ],
  moduleNameMapper: {
    '^@react-native-community/netinfo$': '<rootDir>/src/__mocks__/react-native-community-netinfo.ts',
    '^react-native-keychain$': '<rootDir>/src/__mocks__/react-native-keychain.ts',
    '^react-native-fs$': '<rootDir>/src/__mocks__/react-native-fs.ts',
    '^react-native-ffmpeg-kit$': '<rootDir>/src/__mocks__/react-native-ffmpeg-kit.ts',
    '^@react-native-documents/picker$': '<rootDir>/src/__mocks__/react-native-documents-picker.ts',
    '^react-native-keep-awake$': '<rootDir>/src/__mocks__/react-native-keep-awake.ts',
    '^react-native-audio-recorder-player$': '<rootDir>/src/__mocks__/react-native-audio-recorder-player.ts',
    '^@op-engineering/op-sqlite$': '<rootDir>/src/__mocks__/op-sqlite.ts',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
};
