module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Reanimated 4 (SDK 54): o plugin agora vem do react-native-worklets.
      // Precisa ser o último plugin.
      'react-native-worklets/plugin',
    ],
  };
};
