import { useMemo } from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import MarkdownDisplay from 'react-native-markdown-display';
import { useColors, fonts, type Palette } from '@/theme';

/**
 * Renderiza Markdown nos corpos de tópicos e respostas dos fóruns usando a
 * paleta/fonte do app. Envolve o default export de `react-native-markdown-display`
 * mapeando os tipos de nó (body/heading/strong/em/link/listas/blockquote/código)
 * para as cores do tema atual (claro/escuro) e as famílias `fonts.*`.
 *
 * Corpo ~15px (mesma escala do texto puro que substitui). Links abrem no
 * navegador via `Linking.openURL` (retornamos `false` para suprimir o handler
 * padrão da lib). Mantém-se simples e legível — sem imagens/tabelas custom.
 */

const monospace = Platform.select({ ios: 'Courier', default: 'monospace' });

// Estilos por tipo de nó do markdown-display. As chaves são os nomes dos nós
// da AST da lib (ver src/lib/styles.js): body, heading1-3, strong, em, link,
// bullet_list/ordered_list, list_item, blockquote, code_inline/fence.
function buildStyles(c: Palette) {
  return StyleSheet.create({
    // Corpo / texto base
    body: {
      color: c.fgSoft,
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 24,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 10,
      flexWrap: 'wrap',
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      width: '100%',
    },

    // Títulos (escala enxuta — corpo de fórum, não documento longo)
    heading1: {
      color: c.fg,
      fontFamily: fonts.display,
      fontSize: 20,
      lineHeight: 26,
      marginTop: 4,
      marginBottom: 6,
    },
    heading2: {
      color: c.fg,
      fontFamily: fonts.display,
      fontSize: 17,
      lineHeight: 23,
      marginTop: 4,
      marginBottom: 6,
    },
    heading3: {
      color: c.fg,
      fontFamily: fonts.semibold,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 4,
      marginBottom: 4,
    },

    // Ênfase
    strong: {
      color: c.fg,
      fontFamily: fonts.semibold,
    },
    em: {
      fontFamily: fonts.regular,
      fontStyle: 'italic',
    },

    // Links
    link: {
      color: c.primary,
      fontFamily: fonts.medium,
      textDecorationLine: 'underline',
    },

    // Listas
    bullet_list: {
      marginBottom: 6,
    },
    ordered_list: {
      marginBottom: 6,
    },
    list_item: {
      color: c.fgSoft,
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },

    // Citações
    blockquote: {
      backgroundColor: c.surface2,
      borderColor: c.primary,
      borderLeftWidth: 3,
      borderRadius: 8,
      marginVertical: 4,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },

    // Código
    code_inline: {
      backgroundColor: c.surface2,
      borderColor: c.line,
      borderRadius: 6,
      borderWidth: 1,
      color: c.fg,
      fontFamily: monospace,
      fontSize: 13,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    fence: {
      backgroundColor: c.surface2,
      borderColor: c.line,
      borderRadius: 12,
      borderWidth: 1,
      color: c.fg,
      fontFamily: monospace,
      fontSize: 13,
      marginVertical: 4,
      padding: 12,
    },
  });
}

function onLinkPress(url: string): boolean {
  void Linking.openURL(url);
  // false = não deixa a lib abrir o link por conta própria (já tratamos aqui).
  return false;
}

export function Markdown({ children }: { children: string }) {
  const colors = useColors();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return (
    <MarkdownDisplay style={styles} onLinkPress={onLinkPress}>
      {children}
    </MarkdownDisplay>
  );
}
