const { withMainActivity } = require('@expo/config-plugins');
const { addImports } = require('@expo/config-plugins/build/android/codeMod');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

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
const withHealthConnectPermissionDelegate = (config) =>
  withMainActivity(config, (config) => {
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

module.exports = withHealthConnectPermissionDelegate;
