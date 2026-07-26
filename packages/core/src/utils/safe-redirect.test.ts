import { describe, it, expect } from 'vitest';
import { getSafeNextPath } from './safe-redirect';

describe('getSafeNextPath', () => {
  it('aceita caminhos internos conhecidos', () => {
    expect(getSafeNextPath('/dashboard')).toBe('/dashboard');
    expect(getSafeNextPath('/perfil')).toBe('/perfil');
    expect(getSafeNextPath('/medicamentos?tab=ativos')).toBe('/medicamentos?tab=ativos');
    expect(getSafeNextPath('/diario/novo')).toBe('/diario/novo');
  });

  it('bloqueia open redirect e cai no fallback', () => {
    expect(getSafeNextPath('//evil.com')).toBe('/dashboard');
    expect(getSafeNextPath('https://evil.com')).toBe('/dashboard');
    expect(getSafeNextPath('http://evil.com')).toBe('/dashboard');
    expect(getSafeNextPath('/\\evil.com')).toBe('/dashboard');
    expect(getSafeNextPath('javascript:alert(1)')).toBe('/dashboard');
    expect(getSafeNextPath('/path\\..\\x')).toBe('/dashboard');
  });

  it('bloqueia caminho interno desconhecido (não está na allowlist)', () => {
    expect(getSafeNextPath('/qualquer-coisa')).toBe('/dashboard');
  });

  it('trata valores nulos/vazios/estranhos', () => {
    expect(getSafeNextPath(null)).toBe('/dashboard');
    expect(getSafeNextPath(undefined)).toBe('/dashboard');
    expect(getSafeNextPath('')).toBe('/dashboard');
    expect(getSafeNextPath('dashboard')).toBe('/dashboard'); // sem barra inicial
  });

  it('respeita um fallback customizado', () => {
    expect(getSafeNextPath('//evil', '/login')).toBe('/login');
  });
});
