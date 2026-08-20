const { withMainActivity, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');
const { addImports } = require('@expo/config-plugins/build/android/codeMod');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const RATIONALE_ACTION_LEGACY = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const DEFAULT_CATEGORY = 'android.intent.category.DEFAULT';
const RATIONALE_ACTION_14 = 'android.intent.action.VIEW_PERMISSION_USAGE';
const HEALTH_PERMISSIONS_CATEGORY = 'android.intent.category.HEALTH_PERMISSIONS';
const START_VIEW_PERMISSION_USAGE = 'android.permission.START_VIEW_PERMISSION_USAGE';

/**
 * "Rationale" do Health Connect (tela de privacidade que ele mostra ao
 * usuário) — a exigência muda de forma incompatível entre versões do
 * Android, e https://developer.android.com/health-and-fitness/health-connect/get-started
 * documenta as DUAS como necessárias juntas, num componente CADA:
 *
 *  • Android 13-: <action androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE>
 *    numa <activity> normal — é o que react-native-health-connect's
 *    app.plugin.js adiciona (só a action, faltando a <category DEFAULT>,
 *    exigência básica de resolução de intent implícito — sem ela nem esse
 *    caminho funciona).
 *
 *  • Android 14+ (Health Connect passou a ser parte do SO): exige um
 *    <activity-alias> SEPARADO — não é outro intent-filter na mesma
 *    activity — com a permission android.permission.START_VIEW_PERMISSION_USAGE
 *    e um par ação/categoria totalmente diferente
 *    (VIEW_PERMISSION_USAGE / HEALTH_PERMISSIONS).
 *
 * Sem o alias do Android 14+, a `PermissionsActivity` do Health Connect
 * abre e se fecha sozinha em ~150-200ms (visto ao vivo via `adb logcat`
 * num Samsung Android 14+), logando:
 *   E/PermissionsActivity: App should support rationale intent, finishing!
 * SEM erro nenhum do nosso lado — o pedido "funciona", só que o Health
 * Connect recusa antes de mostrar qualquer tela. Corrigir só a v13- (que já
 * tínhamos feito antes) não resolve em aparelho Android 14+: são checagens
 * independentes.
 */
const withHealthConnectRationale = (config) =>
  withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    const application = config.modResults.manifest.application[0];

    mainActivity['intent-filter'] = mainActivity['intent-filter'] ?? [];
    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': RATIONALE_ACTION_LEGACY } }],
      category: [{ $: { 'android:name': DEFAULT_CATEGORY } }],
    });

    application['activity-alias'] = application['activity-alias'] ?? [];
    application['activity-alias'].push({
      $: {
        'android:name': 'ViewPermissionUsageActivity',
        'android:exported': 'true',
        'android:targetActivity': mainActivity.$['android:name'],
        'android:permission': START_VIEW_PERMISSION_USAGE,
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': RATIONALE_ACTION_14 } }],
          category: [{ $: { 'android:name': HEALTH_PERMISSIONS_CATEGORY } }],
        },
      ],
    });

    return config;
  });

/**
 * react-native-health-connect exige que a MainActivity registre, no onCreate,
 * o ActivityResultLauncher usado pelo diálogo de permissões do Health Connect
 * (https://github.com/matinzd/react-native-health-connect#installation). O
 * plugin embutido no próprio pacote só mexe no AndroidManifest — não faz essa
 * parte. Sem ela, `HealthConnectPermissionDelegate` fica com uma `lateinit
 * var` nunca inicializada: tocar em "Permitir" lança uma coroutine que acessa
 * essa variável, derruba o processo inteiro (exceção nativa fora da bridge —
 * nenhum try/catch em JS alcança) e mostra "o app apresenta falhas contínuas".
 *
 * Vive em `packages/` (pacote de workspace de verdade, com `package.json`
 * próprio) em vez de um arquivo solto em `apps/mobile/plugins/`, porque
 * referenciar um plugin por CAMINHO RELATIVO travava a fase READ_APP_CONFIG
 * no worker remoto do EAS Build ("Unexpected token '{'" ao ler app.config.ts)
 * — comprovado empiricamente. Como pacote resolvido por NOME via
 * node_modules (igual a 'react-native-health-connect', 'expo-camera' etc.,
 * que sempre funcionaram), o worker nunca precisa localizar um arquivo local
 * por caminho.
 */
const withHealthConnectPermissionDelegate = (config) => {
  config = withHealthConnectRationale(config);
  return withMainActivity(config, (config) => {
    const isJava = config.modResults.language === 'java';

    const withImport = addImports(
      config.modResults.contents,
      ['dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate'],
      isJava,
    );

    const merged = mergeContents({
      src: withImport,
      comment: '    //',
      tag: 'health-connect-permission-delegate',
      offset: 0,
      anchor: /super\.onCreate\(null\)/,
      newSrc: `    HealthConnectPermissionDelegate.setPermissionDelegate(this)${isJava ? ';' : ''}`,
    });

    config.modResults.contents = merged.contents;
    return config;
  });
};

module.exports = withHealthConnectPermissionDelegate;
