const { withMainActivity, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');
const { addImports } = require('@expo/config-plugins/build/android/codeMod');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const DEFAULT_CATEGORY = 'android.intent.category.DEFAULT';

/**
 * O plugin embutido em react-native-health-connect (app.plugin.js) adiciona
 * a <action> androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE na
 * MainActivity, mas ESQUECE a <category android.intent.category.DEFAULT>.
 * Sem essa categoria, o intent-filter não é resolvível via intent implícito
 * — é exigência básica do Android, não peculiaridade do Health Connect.
 *
 * Resultado real, visto no logcat de um aparelho físico (Android 14+,
 * Samsung One UI): o Health Connect abre a tela de permissão e a fecha
 * sozinho em menos de 200ms, logando
 *   E/PermissionsActivity: App should support rationale intent, finishing!
 * Nenhum diálogo chega a aparecer, a permissão nunca é concedida, e o app
 * nem aparece na lista de apps conectados do Health Connect — tudo isso
 * SEM erro nenhum do lado do nosso app (o pedido "funciona", só que o
 * Health Connect recusa antes de mostrar qualquer coisa).
 *
 * Corrigido adicionando um SEGUNDO <intent-filter>, completo (ação +
 * categoria), em vez de tentar editar o do plugin upstream — mais simples e
 * não quebra se a versão da lib mudar a implementação dele.
 */
const withHealthConnectRationaleCategory = (config) =>
  withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    mainActivity['intent-filter'] = mainActivity['intent-filter'] ?? [];
    mainActivity['intent-filter'].push({
      action: [{ $: { 'android:name': RATIONALE_ACTION } }],
      category: [{ $: { 'android:name': DEFAULT_CATEGORY } }],
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
  config = withHealthConnectRationaleCategory(config);
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
