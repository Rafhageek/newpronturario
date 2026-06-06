import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema, passwordSchema } from './auth';
import { vitalSchema } from './vitals';
import { medicationSchema, timeOfDaySchema } from './medication';
import { diaryEntrySchema } from './diary';
import { profileSchema } from './profile';

describe('auth schemas', () => {
  it('aceita login válido', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  it('rejeita e-mail inválido', () => {
    expect(loginSchema.safeParse({ email: 'nao-email', password: 'x' }).success).toBe(false);
  });

  it('exige senha forte no cadastro', () => {
    expect(passwordSchema.safeParse('curta').success).toBe(false); // < 8
    expect(passwordSchema.safeParse('semnumeros').success).toBe(false); // sem dígito
    expect(passwordSchema.safeParse('comum123').success).toBe(true);
  });

  it('rejeita cadastro quando senhas não conferem', () => {
    const result = signupSchema.safeParse({
      fullName: 'Maria Silva',
      email: 'maria@ex.com',
      password: 'comum123',
      confirmPassword: 'outra123',
      acceptedTerms: true,
    });
    expect(result.success).toBe(false);
  });

  it('exige aceite dos termos', () => {
    const result = signupSchema.safeParse({
      fullName: 'Maria Silva',
      email: 'maria@ex.com',
      password: 'comum123',
      confirmPassword: 'comum123',
      acceptedTerms: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('vitals schema', () => {
  it('exige diastólica para pressão arterial', () => {
    const result = vitalSchema.safeParse({ type: 'blood_pressure', valuePrimary: 120 });
    expect(result.success).toBe(false);
  });

  it('aceita pressão arterial completa', () => {
    const result = vitalSchema.safeParse({
      type: 'blood_pressure',
      valuePrimary: 120,
      valueSecondary: 80,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita sistólica menor que diastólica', () => {
    const result = vitalSchema.safeParse({
      type: 'blood_pressure',
      valuePrimary: 70,
      valueSecondary: 110,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita saturação acima de 100%', () => {
    const result = vitalSchema.safeParse({ type: 'oxygen_saturation', valuePrimary: 120 });
    expect(result.success).toBe(false);
  });

  it('aceita glicemia simples', () => {
    expect(vitalSchema.safeParse({ type: 'glucose', valuePrimary: 95 }).success).toBe(true);
  });
});

describe('medication schemas', () => {
  it('exige nome do medicamento', () => {
    expect(medicationSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(medicationSchema.safeParse({ name: 'Losartana' }).success).toBe(true);
  });

  it('valida horário HH:MM', () => {
    expect(timeOfDaySchema.safeParse('08:30').success).toBe(true);
    expect(timeOfDaySchema.safeParse('25:00').success).toBe(false);
    expect(timeOfDaySchema.safeParse('8:5').success).toBe(false);
  });
});

describe('diary schema', () => {
  it('limita humor entre 1 e 5', () => {
    expect(diaryEntrySchema.safeParse({ mood: 3 }).success).toBe(true);
    expect(diaryEntrySchema.safeParse({ mood: 9 }).success).toBe(false);
  });
});

describe('profile schema', () => {
  it('rejeita data de nascimento no futuro', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    const result = profileSchema.safeParse({ fullName: 'João', dateOfBirth: future });
    expect(result.success).toBe(false);
  });

  it('aceita perfil mínimo válido', () => {
    expect(profileSchema.safeParse({ fullName: 'João Pereira' }).success).toBe(true);
  });
});
