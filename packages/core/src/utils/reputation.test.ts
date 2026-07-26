import { describe, it, expect } from 'vitest';
import { reputationLevel } from './reputation';

describe('reputationLevel', () => {
  it('Novato no piso e logo abaixo do próximo', () => {
    expect(reputationLevel(0).label).toBe('Novato');
    expect(reputationLevel(49).label).toBe('Novato');
    expect(reputationLevel(0).index).toBe(0);
  });

  it('sobe de nível exatamente no limiar', () => {
    expect(reputationLevel(50).label).toBe('Participante');
    expect(reputationLevel(199).label).toBe('Participante');
    expect(reputationLevel(200).label).toBe('Contribuidor');
    expect(reputationLevel(499).label).toBe('Contribuidor');
    expect(reputationLevel(500).label).toBe('Veterano');
    expect(reputationLevel(999).label).toBe('Veterano');
    expect(reputationLevel(1000).label).toBe('Lenda da Comunidade');
    expect(reputationLevel(999999).label).toBe('Lenda da Comunidade');
  });

  it('pontos negativos caem em Novato (moderação)', () => {
    expect(reputationLevel(-50).label).toBe('Novato');
    expect(reputationLevel(-1).index).toBe(0);
  });

  it('calcula faltante para o próximo nível', () => {
    expect(reputationLevel(0).next).toBe(50);
    expect(reputationLevel(0).toNext).toBe(50);
    expect(reputationLevel(30).toNext).toBe(20);
    expect(reputationLevel(200).next).toBe(500);
  });

  it('no topo não há próximo nível', () => {
    const top = reputationLevel(1500);
    expect(top.next).toBeNull();
    expect(top.toNext).toBe(0);
  });

  it('tolera valores quebrados/inválidos', () => {
    expect(reputationLevel(50.9).label).toBe('Participante');
    expect(reputationLevel(NaN).label).toBe('Novato');
  });
});
