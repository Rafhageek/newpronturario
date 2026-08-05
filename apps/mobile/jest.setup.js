/* eslint-disable @typescript-eslint/no-require-imports */
// Setup global dos testes (setupFilesAfterEnv). Mocks mínimos e justificados
// para rodar componentes RN em Node sem o runtime nativo.

// Reanimated: usa o mock oficial da lib (worklets viram no-ops). Sem ele,
// useSharedValue/useAnimatedStyle quebram fora da UI thread nativa.
require('react-native-reanimated').setUpTests?.();
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // O mock oficial não traz `useReducedMotion` (usado por PressableScale, sheet
  // e tab-bar). Sem isto, qualquer teste que renderize um botão do design
  // system quebra com "useReducedMotion is not a function".
  return { ...mock, useReducedMotion: () => false };
});

// Gesture Handler: setup oficial p/ jest (registra gestos/Swipeable em JSDOM/Node).
require('react-native-gesture-handler/jestSetup');

// expo-haptics: chamada em PressableScale/toast; em Node não há hardware.
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
