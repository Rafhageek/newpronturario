import { describe, expect, it } from 'vitest';
import { detectContentRisk } from './content-guard';
import { CRISIS_NOTICE } from '../constants/social';

describe('detectContentRisk — posologia', () => {
  it('detecta dose numérica com unidade (mg)', () => {
    const r = detectContentRisk('Tomo 500 mg de paracetamol por dia.');
    expect(r.posology).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.messages.some((m) => m.includes('seu médico'))).toBe(true);
  });

  it('detecta dose colada à unidade (10ml)', () => {
    const r = detectContentRisk('Dei 10ml do xarope pra ela.');
    expect(r.posology).toBe(true);
  });

  it('detecta "2 comprimidos"', () => {
    expect(detectContentRisk('Tome 2 comprimidos a cada 8 horas').posology).toBe(true);
  });

  it('detecta frase de ajuste de tratamento', () => {
    const r = detectContentRisk('Pare de tomar o remédio que o médico passou.');
    expect(r.posology).toBe(true);
  });

  it('detecta "substitua o remédio"', () => {
    expect(detectContentRisk('Substitua o remedio por esse outro').posology).toBe(true);
  });

  it('é tolerante a acentos (cápsulas)', () => {
    expect(detectContentRisk('Tomei 3 cápsulas hoje').posology).toBe(true);
  });
});

describe('detectContentRisk — venda de medicamento', () => {
  it('bloqueia "vendo insulina"', () => {
    const r = detectContentRisk('Vendo insulina, quem precisar chama no pv.');
    expect(r.medSale).toBe(true);
    expect(r.blocked).toBe(true);
    expect(r.messages.some((m) => m.includes('proibida por lei'))).toBe(true);
  });

  it('bloqueia "compro remédio"', () => {
    expect(detectContentRisk('Compro remédio controlado, pago bem').blocked).toBe(true);
  });

  it('bloqueia "troco medicamento"', () => {
    expect(detectContentRisk('Troco medicamento que sobrou aqui em casa').blocked).toBe(true);
  });

  it('bloqueia doação de remédio', () => {
    expect(detectContentRisk('Faço doação de remédios que não uso mais').blocked).toBe(true);
  });

  it('não bloqueia menção neutra a remédio', () => {
    const r = detectContentRisk('Esse remédio me ajudou muito com a ansiedade.');
    expect(r.medSale).toBe(false);
    expect(r.blocked).toBe(false);
  });
});

describe('detectContentRisk — crise', () => {
  it('aciona crise para ideação suicida sem bloquear', () => {
    const r = detectContentRisk('Às vezes penso em me matar, não aguento mais.');
    expect(r.crisis).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.messages).toContain(CRISIS_NOTICE);
  });

  it('aciona crise para automutilação', () => {
    const r = detectContentRisk('Tenho vontade de me cortar quando fico assim.');
    expect(r.crisis).toBe(true);
  });

  it('aciona crise para transtorno alimentar (vomitar pra emagrecer)', () => {
    expect(detectContentRisk('comecei a vomitar pra emagrecer').crisis).toBe(true);
  });

  it('"não quero mais viver" aciona crise', () => {
    expect(detectContentRisk('não quero mais viver desse jeito').crisis).toBe(true);
  });
});

describe('detectContentRisk — sem falsos positivos', () => {
  it('texto normal não dispara nada', () => {
    const r = detectContentRisk('Hoje fui ao médico e me senti acolhida.');
    expect(r).toEqual({
      posology: false,
      medSale: false,
      crisis: false,
      blocked: false,
      messages: [],
    });
  });

  it('"tomei sol" não é posologia', () => {
    expect(detectContentRisk('Tomei sol na praia no fim de semana').posology).toBe(false);
  });

  it('"vendi minha bicicleta" não é venda de medicamento', () => {
    expect(detectContentRisk('Vendi minha bicicleta antiga ontem').medSale).toBe(false);
  });

  it('texto vazio é seguro', () => {
    expect(detectContentRisk('').blocked).toBe(false);
  });

  it('agrega múltiplas mensagens (venda + dose)', () => {
    const r = detectContentRisk('Vendo insulina 100mg, ótimo preço');
    expect(r.medSale).toBe(true);
    expect(r.posology).toBe(true);
    expect(r.messages.length).toBeGreaterThanOrEqual(2);
  });
});
