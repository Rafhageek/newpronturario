import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'VidaLog',
  slug: 'vidalog',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'vidalog', // deep link: vidalog://
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: { supportsTablet: true, bundleIdentifier: 'br.com.vidalog.app' },
  android: { package: 'br.com.vidalog.app' },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: { typedRoutes: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default config;
