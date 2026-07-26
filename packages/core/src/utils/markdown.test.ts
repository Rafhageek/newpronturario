import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml, stripMarkdown } from './markdown';

describe('renderMarkdownToHtml', () => {
  it('escapa HTML (XSS) antes de formatar', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('negrito e itálico', () => {
    expect(renderMarkdownToHtml('**forte**')).toBe('<p><strong>forte</strong></p>');
    expect(renderMarkdownToHtml('*leve*')).toBe('<p><em>leve</em></p>');
  });

  it('lista com - ou *', () => {
    expect(renderMarkdownToHtml('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdownToHtml('* x')).toBe('<ul><li>x</li></ul>');
  });

  it('não confunde *itálico* com marcador de lista', () => {
    expect(renderMarkdownToHtml('*só ênfase*')).toBe('<p><em>só ênfase</em></p>');
  });

  it('citação agrupa linhas', () => {
    expect(renderMarkdownToHtml('> linha 1\n> linha 2')).toBe(
      '<blockquote>linha 1<br>linha 2</blockquote>',
    );
  });

  it('parágrafo com quebra de linha vira <br>', () => {
    expect(renderMarkdownToHtml('a\nb')).toBe('<p>a<br>b</p>');
  });

  it('blocos separados por linha em branco', () => {
    expect(renderMarkdownToHtml('um\n\n- item')).toBe('<p>um</p><ul><li>item</li></ul>');
  });

  it('string vazia → vazio', () => {
    expect(renderMarkdownToHtml('')).toBe('');
  });
});

describe('stripMarkdown', () => {
  it('remove marcação para prévia', () => {
    expect(stripMarkdown('**oi** *gente*')).toBe('oi gente');
    expect(stripMarkdown('- item')).toBe('item');
    expect(stripMarkdown('> citação')).toBe('citação');
  });
});
