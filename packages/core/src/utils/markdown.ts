// ============================================================================
// Renderer de markdown BÁSICO e SEGURO para posts do fórum.
// Suporta: **negrito**, *itálico*, listas ("- " ou "* "), citação ("> ") e
// quebras de linha. NÃO suporta HTML, imagens ou links — numa comunidade de
// saúde, menos superfície = menos risco. A entrada é escapada ANTES de aplicar
// o markdown, então o resultado é seguro para dangerouslySetInnerHTML.
// ============================================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Formatação inline (aplicada sobre texto já escapado). */
function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}

const isBlank = (l: string) => /^\s*$/.test(l);
const isQuote = (l: string) => /^&gt;\s?/.test(l); // ">" vira "&gt;" após escape
const isItem = (l: string) => /^\s*[-*]\s+/.test(l);

/** Converte markdown básico em HTML seguro. */
export function renderMarkdownToHtml(src: string): string {
  const escaped = escapeHtml((src ?? '').replace(/\r\n/g, '\n'));
  const lines = escaped.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isQuote(line)) {
      const buf: string[] = [];
      while (i < lines.length && isQuote(lines[i] ?? '')) {
        buf.push(inline((lines[i] ?? '').replace(/^&gt;\s?/, '')));
        i++;
      }
      out.push(`<blockquote>${buf.join('<br>')}</blockquote>`);
      continue;
    }

    if (isItem(line)) {
      const items: string[] = [];
      while (i < lines.length && isItem(lines[i] ?? '')) {
        items.push(`<li>${inline((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? '';
      if (isBlank(l) || isQuote(l) || isItem(l)) break;
      buf.push(inline(l));
      i++;
    }
    out.push(`<p>${buf.join('<br>')}</p>`);
  }

  return out.join('');
}

/** Texto puro (sem marcação) para prévias/metadados. */
export function stripMarkdown(src: string): string {
  return (src ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .trim();
}
