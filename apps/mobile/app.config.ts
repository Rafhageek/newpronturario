import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'HubPatients',
  slug: 'hubpatients',
  owner: 'pronuario', // conta/organização Expo dona do projeto (EAS)
  version: '0.4.0', // 0.4.0 = fontes Atkinson Hyperlegible (legibilidade/segurança de dose)
  orientation: 'portrait',
  scheme: 'hubpatients', // deep link: hubpatients:// (usado no OAuth Google mobile)
  userInterfaceStyle: 'automatic', // suporta claro/escuro (tema "Sistema" segue o SO)
  newArchEnabled: true,
  // OTA via EAS Update. O runtimeVersion amarra o update ao binário compatível.
  //
  // runtimeVersion FIXO, bumpado a cada mudança nativa.
  //
  // ⚠️ NÃO troque por { policy: 'fingerprint' }. Já tentamos (build f8d7892f,
  // 2026-07-25) e o EAS falha na fase CONFIGURE_EXPO_UPDATES com "Difference
  // between local and EAS fingerprints": neste monorepo pnpm o hash calculado
  // na máquina do dev (Windows, node_modules/.pnpm/...) não bate com o do
  // servidor de build (Linux, após `pnpm install --no-frozen-lockfile`).
  // Forçar com EAS_SKIP_AUTO_FINGERPRINT=1 seria PIOR: o APK ficaria com um
  // fingerprint que nenhum `eas update` publicado daqui conseguiria alcançar,
  // e o OTA morreria em silêncio.
  //
  // A proteção contra esquecer o bump é o guard automático:
  //   pnpm --filter @hubpatients/mobile run check:runtime
  // que compara o hash das entradas nativas com o registrado em
  // `native-fingerprint.json` e falha se mudou sem bump. Roda no CI.
  runtimeVersion: '0.5.0', // bump: novo plugin nativo (withHealthConnectPermissionDelegate)
  updates: { url: 'https://u.expo.dev/dad7daea-2577-4c30-a744-26466879562b' },
  icon: './assets/icon.png',
  // Logo final HubPatients (gerada de img/Logo.png).
  // Regenerar: node apps/mobile/scripts/gen-logo-assets.mjs
  // ATENÇÃO: ícone/splash são NATIVOS — trocar aqui só tem efeito com build novo (não vai por OTA).
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff', // logo azul sobre branco (vinha de #0284C7)
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'br.com.hubpatients.app',
    buildNumber: '2',
    // Chave do Google Maps (iOS). Lida do .env (gitignored) — nunca commitada.
    config: { googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY },
  },
  android: {
    package: 'br.com.hubpatients.app',
    versionCode: 2,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff', // logo azul sobre branco (vinha de #0284C7)
    },
    // Chave do Google Maps (Android) p/ o mapa interativo (react-native-maps).
    // Lida do .env (gitignored) — habilitar "Maps SDK for Android" no Google Cloud.
    config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY } },
    // Health Connect — SOMENTE leitura; o app nunca escreve dado de saúde de
    // volta. Cada permissão pedida corresponde a uma tela que já existe no app
    // (minimização: não pedimos o que não usamos — política do Google Play para
    // dados de saúde é rigorosa e derruba submissão que pede sem usar).
    permissions: [
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_WEIGHT',
      'android.permission.health.READ_BLOOD_PRESSURE',
      'android.permission.health.READ_BLOOD_GLUCOSE',
      'android.permission.health.READ_HEART_RATE',
      'android.permission.health.READ_OXYGEN_SATURATION',
      'android.permission.health.READ_SLEEP',
    ],
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      'expo-local-authentication',
      { faceIDPermission: 'Use o Face ID para desbloquear o HubPatients com segurança.' },
    ],
    ['expo-notifications', { color: '#0442BF' }],
    [
      'expo-location',
      { locationWhenInUsePermission: 'O HubPatients usa sua localização para encontrar farmácias próximas.' },
    ],
    // Passos via Health Connect (Android). O plugin adiciona o intent-filter de
    // "rationale"; a permissão READ_STEPS é declarada em android.permissions.
    'react-native-health-connect',
    // O plugin acima só mexe no AndroidManifest — não registra o
    // ActivityResultLauncher que o Health Connect precisa na MainActivity.
    // Sem isso, tocar em "Permitir" derruba o app (ver comentário no arquivo).
    './plugins/withHealthConnectPermissionDelegate',
    // Health Connect exige minSdkVersion 26 (Android 8.0).
    ['expo-build-properties', { android: { minSdkVersion: 26 } }],
    // Câmera: leitura de código de barras da caixa do remédio e do alimento.
    [
      'expo-camera',
      {
        cameraPermission:
          'O HubPatients usa a câmera para ler o código de barras da embalagem e preencher o cadastro para você.',
        recordAudioAndroid: false,
      },
    ],
    // Ditado por voz no diário (quem tem tremor ou artrose não digita).
    [
      'expo-speech-recognition',
      {
        microphonePermission:
          'O HubPatients usa o microfone para você ditar o que sente, em vez de digitar.',
        speechRecognitionPermission:
          'O HubPatients converte sua fala em texto para registrar no seu diário.',
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: { projectId: 'dad7daea-2577-4c30-a744-26466879562b' },
  },
};

export default config;
