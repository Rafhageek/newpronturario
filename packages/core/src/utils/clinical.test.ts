import { describe, it, expect } from 'vitest';
import { classifyBloodPressure, findMedicationAllergyNameMatch, moodEnergyAverage } from './health';
import {
  classifyMetric,
  isCriticalValue,
  normalizeMetricKey,
  buildExamNarrative,
  metricClassificationForPersistence,
} from './exams';
import { computeStats, computeTrendPct, computeBMI, bmiCategory } from './stats';
import { computeAdherence, findInteractions } from './health';
import { recommendContentByCids } from './education';
import { describeGlucoseRange } from '../constants/analysis';
import { isFeatureAvailable } from '../constants/plans';
import type { ExamMetric, DrugInteraction, HealthContent } from '../types/db';

describe('classifyBloodPressure (faixa de referência)', () => {
  it('classifica ok/atenção/alerta', () => {
    expect(classifyBloodPressure(118, 75).zone).toBe('ok');
    expect(classifyBloodPressure(135, 86).zone).toBe('attention');
    expect(classifyBloodPressure(150, 95).zone).toBe('alert');
  });
});

describe('classifyMetric', () => {
  it('dentro da faixa = ok; fora por pouco = atenção; muito fora = alerta', () => {
    expect(classifyMetric(100, 70, 110)).toBe('ok');
    expect(classifyMetric(118, 70, 110)).toBe('attention');
    expect(classifyMetric(150, 70, 110)).toBe('alert');
    expect(classifyMetric(null, 70, 110)).toBe('unclassified');
    expect(classifyMetric(100, null, null)).toBe('unclassified');
  });

  it('persiste explicitamente o estado não classificado', () => {
    expect(metricClassificationForPersistence('unclassified')).toBe('unclassified');
  });
});

describe('isCriticalValue', () => {
  it('detecta valor crítico por chave', () => {
    expect(isCriticalValue('glicose_jejum', 300)).toBe(true);
    expect(isCriticalValue('glicose_jejum', 90)).toBe(false);
    expect(isCriticalValue('potassio', 2.5)).toBe(true);
    expect(isCriticalValue('desconhecido', 9999)).toBe(false);
  });
});

describe('normalizeMetricKey', () => {
  it('remove acentos e normaliza', () => {
    expect(normalizeMetricKey('Glicose (jejum)')).toBe('glicose_jejum');
    expect(normalizeMetricKey('Hemoglobina')).toBe('hemoglobina');
  });
});

describe('computeStats / trend / BMI', () => {
  it('estatísticas básicas', () => {
    expect(computeStats([])).toBeNull();
    expect(computeStats([10, 20, 30])).toEqual({ count: 3, avg: 20, min: 10, max: 30 });
  });
  it('tendência percentual', () => {
    expect(computeTrendPct([100, 110])).toBe(10);
    expect(computeTrendPct([100])).toBeNull();
  });
  it('IMC e categoria', () => {
    expect(computeBMI(70, 175)).toBeCloseTo(22.86, 1);
    expect(computeBMI(null, 175)).toBeNull();
    expect(bmiCategory(22).tone).toBe('ok');
    expect(bmiCategory(32).tone).toBe('alert');
  });
});

describe('describeGlucoseRange', () => {
  it('descreve somente o intervalo numérico, sem linguagem diagnóstica', () => {
    expect(describeGlucoseRange(90)).toBe('abaixo de 100 mg/dL');
    expect(describeGlucoseRange(110)).toBe('de 100 a menos de 126 mg/dL');
    expect(describeGlucoseRange(130)).toBe('126 mg/dL ou mais');
  });
});

describe('computeAdherence', () => {
  it('percentual limitado a 100', () => {
    expect(computeAdherence(7, 14)).toBe(50);
    expect(computeAdherence(20, 14)).toBe(100);
    expect(computeAdherence(0, 0)).toBeNull();
  });
});

describe('findInteractions', () => {
  const base: DrugInteraction[] = [
    { id: '1', drug_a: 'varfarina', drug_b: 'aspirina', severity: 'major', description: 'x', created_at: '' },
  ];
  it('cruza por substring case-insensitive', () => {
    expect(findInteractions(['Varfarina 5mg', 'AAS Aspirina'], base)).toHaveLength(1);
    expect(findInteractions(['Dipirona'], base)).toHaveLength(0);
  });
});

describe('findMedicationAllergyNameMatch', () => {
  const allergies = [
    { id: '1', substance: 'Amoxicilina' },
    { id: '2', substance: 'Dipirona' },
  ];

  it('encontra correspondência textual nos dois sentidos e ignora maiúsculas', () => {
    expect(findMedicationAllergyNameMatch('AMOXICILINA 500 mg', allergies)?.id).toBe('1');
    expect(findMedicationAllergyNameMatch('Dipirona', [{ substance: 'Dipirona monoidratada' }]))
      .toEqual({ substance: 'Dipirona monoidratada' });
  });

  it('não cria correspondência para nome vazio ou substância diferente', () => {
    expect(findMedicationAllergyNameMatch('', allergies)).toBeUndefined();
    expect(findMedicationAllergyNameMatch('Losartana', allergies)).toBeUndefined();
  });
});

describe('segurança medicamentosa por plano', () => {
  it('mantém alertas de possíveis interações no plano gratuito', () => {
    expect(isFeatureAvailable('medication_interaction_alerts', 'free')).toBe(true);
    expect(isFeatureAvailable('medication_interaction_alerts', 'plus')).toBe(true);
  });
});

describe('moodEnergyAverage', () => {
  it('média de humor/energia no período', () => {
    const now = new Date('2026-06-06');
    const entries = [
      { mood: 4, energy: 2, entry_date: '2026-06-05' },
      { mood: 2, energy: 4, entry_date: '2026-06-04' },
      { mood: 5, energy: 5, entry_date: '2026-01-01' }, // fora dos 7 dias
    ];
    const r = moodEnergyAverage(entries, 7, now);
    expect(r.mood).toBe(3);
    expect(r.energy).toBe(3);
  });
});

describe('recommendContentByCids', () => {
  const content: HealthContent[] = [
    { id: '1', title: 'Hipertensão', body: '', tags: ['I10'], reading_minutes: 3, source: 's', source_url: null, created_at: '' },
    { id: '2', title: 'Geral', body: '', tags: [], reading_minutes: 2, source: 's', source_url: null, created_at: '' },
  ];
  it('prioriza conteúdo que casa com os CIDs do usuário', () => {
    const ordered = recommendContentByCids(content, ['I10']);
    expect(ordered[0]!.id).toBe('1');
  });

  it('buildExamNarrative gera resumo não-vazio', () => {
    const metrics: ExamMetric[] = [
      { id: '1', exam_id: 'e', patient_id: 'p', name: 'LDL', metric_code: null, value: 200, value_text: null, unit: 'mg/dL', reference_min: 0, reference_max: 130, flag: 'alert', measured_at: null, created_at: '' },
    ];
    const n = buildExamNarrative(metrics);
    expect(n.summary.length).toBeGreaterThan(0);
    expect(n.attention.length).toBe(1);
    expect(n.questions.length).toBeGreaterThan(0);
  });

  it('buildExamNarrative não conta métrica sem referência como normal', () => {
    const metrics: ExamMetric[] = [
      { id: '1', exam_id: 'e', patient_id: 'p', name: 'Ferritina', metric_code: null, value: 80, value_text: null, unit: 'ng/mL', reference_min: null, reference_max: null, flag: 'ok', measured_at: null, created_at: '' },
    ];

    const narrative = buildExamNarrative(metrics);

    expect(narrative.normal).toHaveLength(0);
    expect(narrative.attention).toHaveLength(0);
    expect(narrative.unclassified).toHaveLength(1);
    expect(narrative.summary.join(' ')).toContain('não classificado');
    expect(narrative.summary.join(' ')).not.toContain('dentro da faixa');
  });
});
