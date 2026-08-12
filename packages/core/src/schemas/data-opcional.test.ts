import { describe, it, expect } from 'vitest';
import { dataOpcional } from './data-opcional';
import {
  conditionSchema,
  surgerySchema,
  insuranceSchema,
  appointmentSchema,
  type ConditionInput,
  type SurgeryInput,
} from './clinical';
import { medicationSchema, type MedicationInput } from './medication';
import { profileSchema, type ProfileInput } from './profile';
import { examSchema } from './exam';
import { vitalSchema } from './vitals';
import { cycleLogSchema } from './cycle';
import { startPregnancySchema } from './pregnancy';
import { growthMeasurementSchema, recordVaccineSchema } from './child';

/**
 * Regressão do bug que fazia o botão "Salvar" não fazer nada:
 * `<input type="date">` vazio manda `''`, e `z.coerce.date().optional()`
 * transformava isso em Invalid Date, reprovando o formulário inteiro em
 * silêncio. Estes testes reprovam a versão antiga dos schemas.
 */

// --- Contrato de TIPO (falha no typecheck se a saída deixar de ser Date | undefined) ---
/**
 * Igualdade ESTRITA de tipos, não "um cabe no outro".
 *
 * A versão anterior testava assinalabilidade mútua, e isso passa para pares que
 * são tipos diferentes mas se aceitam: `any` contra qualquer coisa, e um
 * `Date | undefined` contra um alias que na prática fosse mais largo. Como este
 * arquivo existe justamente para travar a saída `Date | undefined` (as telas
 * fazem `values.diagnosedAt?.toISOString()`), o teste tem de ser exato.
 *
 * O truque com a função genérica é o que o TypeScript usa internamente: duas
 * assinaturas idênticas só são mutuamente assinaláveis quando o tipo adiado
 * `T extends A` e `T extends B` é o MESMO tipo — inclusive para `any`.
 */
type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// Prova de que o helper aperta de verdade: se ele ainda fosse assinalabilidade
// mútua, `any` passaria como igual a `Date | undefined`. O `any` aqui é o
// próprio objeto do teste, por isso a regra fica desligada só nesta linha.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _igualEstrito: Igual<any, Date | undefined> = false;
void _igualEstrito;

const _tipoCondicao: Igual<ConditionInput['diagnosedAt'], Date | undefined> = true;
const _tipoCirurgia: Igual<SurgeryInput['performedAt'], Date | undefined> = true;
const _tipoMedicamentoInicio: Igual<MedicationInput['startedAt'], Date | undefined> = true;
const _tipoMedicamentoFim: Igual<MedicationInput['endedAt'], Date | undefined> = true;
void _tipoCondicao;
void _tipoCirurgia;
void _tipoMedicamentoInicio;
void _tipoMedicamentoFim;

describe('dataOpcional (helper)', () => {
  it('trata vazio, espaços, null e undefined como "não informado"', () => {
    for (const entrada of ['', '   ', '\t', null, undefined]) {
      const r = dataOpcional.safeParse(entrada);
      expect(r.success, `entrada: ${JSON.stringify(entrada)}`).toBe(true);
      if (r.success) expect(r.data).toBeUndefined();
    }
  });

  it('aceita data válida e devolve Date', () => {
    const r = dataOpcional.safeParse('2026-02-28');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toBeInstanceOf(Date);
      expect((r.data as Date).toISOString().slice(0, 10)).toBe('2026-02-28');
    }
  });

  it('aceita Date já pronto', () => {
    const d = new Date('2026-01-15T00:00:00.000Z');
    const r = dataOpcional.safeParse(d);
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as Date).getTime()).toBe(d.getTime());
  });

  it('ignora espaços em volta de uma data válida', () => {
    const r = dataOpcional.safeParse('  2026-03-10  ');
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as Date).toISOString().slice(0, 10)).toBe('2026-03-10');
  });

  it('REPROVA data inventada ou lixo (data errada é pior que data ausente)', () => {
    for (const lixo of ['abc', '31/02/2026', '2026-02-31', '2026-13-01', 'ontem', '99/99/9999']) {
      expect(dataOpcional.safeParse(lixo).success, `deveria reprovar: ${lixo}`).toBe(false);
    }
  });

  it('usa mensagem em português quando reprova', () => {
    const r = dataOpcional.safeParse('abc');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('Data inválida.');
  });
});

describe('condição de saúde (diagnosedAt)', () => {
  it('(a) data vazia PASSA e sai como undefined', () => {
    const r = conditionSchema.safeParse({ name: 'Hipertensão', diagnosedAt: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.diagnosedAt).toBeUndefined();
  });

  it('(b) data válida PASSA e sai como Date', () => {
    const r = conditionSchema.safeParse({ name: 'Hipertensão', diagnosedAt: '2020-05-10' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.diagnosedAt).toBeInstanceOf(Date);
      expect(r.data.diagnosedAt?.toISOString().slice(0, 10)).toBe('2020-05-10');
    }
  });

  it('(c) data absurda REPROVA', () => {
    expect(conditionSchema.safeParse({ name: 'Hipertensão', diagnosedAt: '31/02/2026' }).success).toBe(false);
    expect(conditionSchema.safeParse({ name: 'Hipertensão', diagnosedAt: 'abc' }).success).toBe(false);
  });

  it('(d) undefined PASSA (e campo ausente também)', () => {
    expect(conditionSchema.safeParse({ name: 'Hipertensão', diagnosedAt: undefined }).success).toBe(true);
    expect(conditionSchema.safeParse({ name: 'Hipertensão' }).success).toBe(true);
  });

  it('null (vindo do banco) PASSA como undefined', () => {
    const r = conditionSchema.safeParse({ name: 'Hipertensão', diagnosedAt: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.diagnosedAt).toBeUndefined();
  });

  it('não afrouxa o campo obrigatório', () => {
    expect(conditionSchema.safeParse({ name: '', diagnosedAt: '' }).success).toBe(false);
  });
});

describe('cirurgia (performedAt)', () => {
  it('(a) data vazia PASSA e sai como undefined', () => {
    const r = surgerySchema.safeParse({ procedure: 'Colecistectomia', performedAt: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.performedAt).toBeUndefined();
  });

  it('(b) data válida PASSA e sai como Date', () => {
    const r = surgerySchema.safeParse({ procedure: 'Colecistectomia', performedAt: '2019-11-02' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.performedAt?.toISOString().slice(0, 10)).toBe('2019-11-02');
  });

  it('(c) data absurda REPROVA', () => {
    expect(surgerySchema.safeParse({ procedure: 'Colecistectomia', performedAt: '31/02/2026' }).success).toBe(false);
    expect(surgerySchema.safeParse({ procedure: 'Colecistectomia', performedAt: 'abc' }).success).toBe(false);
  });

  it('(d) undefined PASSA', () => {
    expect(surgerySchema.safeParse({ procedure: 'Colecistectomia' }).success).toBe(true);
  });
});

describe('medicamento (startedAt / endedAt)', () => {
  it('(a) as duas datas vazias PASSAM e saem como undefined', () => {
    const r = medicationSchema.safeParse({ name: 'Losartana', startedAt: '', endedAt: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startedAt).toBeUndefined();
      expect(r.data.endedAt).toBeUndefined();
    }
  });

  it('(b) datas válidas PASSAM e saem como Date', () => {
    const r = medicationSchema.safeParse({ name: 'Losartana', startedAt: '2025-01-02', endedAt: '2025-06-30' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startedAt?.toISOString().slice(0, 10)).toBe('2025-01-02');
      expect(r.data.endedAt?.toISOString().slice(0, 10)).toBe('2025-06-30');
    }
  });

  it('(c) data absurda REPROVA', () => {
    expect(medicationSchema.safeParse({ name: 'Losartana', startedAt: '31/02/2026' }).success).toBe(false);
    expect(medicationSchema.safeParse({ name: 'Losartana', endedAt: 'abc' }).success).toBe(false);
  });

  it('(d) undefined PASSA', () => {
    expect(medicationSchema.safeParse({ name: 'Losartana' }).success).toBe(true);
  });

  it('início vazio com fim preenchido continua funcionando', () => {
    const r = medicationSchema.safeParse({ name: 'Losartana', startedAt: '', endedAt: '2025-06-30' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startedAt).toBeUndefined();
      expect(r.data.endedAt).toBeInstanceOf(Date);
    }
  });
});

describe('demais telas com data opcional', () => {
  it('convênio, exame, sinal vital, ciclo, vacina e medida infantil aceitam data vazia', () => {
    expect(insuranceSchema.safeParse({ operator: 'Unimed', validUntil: '' }).success).toBe(true);
    expect(examSchema.safeParse({ name: 'Hemograma', examDate: '' }).success).toBe(true);
    expect(vitalSchema.safeParse({ type: 'glucose', valuePrimary: 95, measuredAt: '' }).success).toBe(true);
    expect(cycleLogSchema.safeParse({ logDate: '' }).success).toBe(true);
    expect(recordVaccineSchema.safeParse({ vaccineName: 'Tríplice viral', appliedAt: '' }).success).toBe(true);
    expect(growthMeasurementSchema.safeParse({ measuredAt: '', weightKg: 12 }).success).toBe(true);
  });

  it('gestação: DPP vazia + DUM preenchida PASSA; as duas vazias continuam reprovando', () => {
    const ok = startPregnancySchema.safeParse({ dueDate: '', lmpDate: '2026-01-05' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.dueDate).toBeUndefined();

    expect(startPregnancySchema.safeParse({ dueDate: '', lmpDate: '' }).success).toBe(false);
  });
});

describe('datas OBRIGATÓRIAS não foram afrouxadas', () => {
  it('consulta ainda exige data e hora', () => {
    // scheduledAt continua obrigatório: vazio tem de reprovar.
    expect(appointmentSchema.safeParse({ doctorName: 'Dra. Ana', scheduledAt: '' }).success).toBe(false);
    expect(appointmentSchema.safeParse({ doctorName: 'Dra. Ana' }).success).toBe(false);
  });

  it('a mensagem de "data e hora" aparece em PORTUGUÊS também para campo VAZIO', () => {
    // `required_error` só dispara com `undefined`. O <input type="datetime-local">
    // vazio manda `''`, que ia parar em `new Date('')` e devolvia a mensagem
    // padrão do Zod, "Invalid date" — em inglês, na cara do usuário.
    for (const entrada of ['', '   ', undefined]) {
      const r = appointmentSchema.safeParse({ doctorName: 'Dra. Ana', scheduledAt: entrada });
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.issues.find((i) => i.path[0] === 'scheduledAt');
        expect(issue?.message, `entrada: ${JSON.stringify(entrada)}`).toBe('Informe data e hora.');
      }
    }
  });

  it('consulta REPROVA data que não existe no calendário', () => {
    // Consulta marcada em 31/02 vira 03/03 em silêncio: agendamento inventado.
    expect(appointmentSchema.safeParse({ doctorName: 'Dra. Ana', scheduledAt: '2026-02-31T14:30' }).success).toBe(false);
    expect(appointmentSchema.safeParse({ doctorName: 'Dra. Ana', scheduledAt: '2026-02-28T14:30' }).success).toBe(true);
  });
});

/**
 * "Dados pessoais" é a primeira tela de quem está começando. Enquanto
 * `dateOfBirth` e `heightCm` reprovavam a string vazia, o botão "Salvar" não
 * gravava NEM o nome, NEM o tipo sanguíneo, NEM a observação de emergência —
 * e a mensagem que aparecia era "Invalid date", em inglês.
 */
describe('dados pessoais (profileSchema)', () => {
  // Contrato de TIPO: as telas fazem `values.dateOfBirth?.toISOString()` e
  // `values.heightCm ?? null`. Se a saída deixar de ser Date/number, quebra.
  const _tipoNascimento: Igual<ProfileInput['dateOfBirth'], Date | undefined> = true;
  const _tipoAltura: Igual<ProfileInput['heightCm'], number | undefined> = true;
  void _tipoNascimento;
  void _tipoAltura;

  it('(a) data de nascimento VAZIA passa e sai como undefined', () => {
    for (const entrada of ['', '   ', null, undefined]) {
      const r = profileSchema.safeParse({ fullName: 'João Pereira', dateOfBirth: entrada });
      expect(r.success, `entrada: ${JSON.stringify(entrada)}`).toBe(true);
      if (r.success) expect(r.data.dateOfBirth).toBeUndefined();
    }
  });

  it('(b) data de nascimento vazia NÃO impede salvar o resto do cadastro', () => {
    const r = profileSchema.safeParse({
      fullName: 'João Pereira',
      dateOfBirth: '',
      heightCm: '',
      bloodType: 'O+',
      emergencyNote: 'Uso marca-passo.',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bloodType).toBe('O+');
      expect(r.data.emergencyNote).toBe('Uso marca-passo.');
    }
  });

  it('(c) data de nascimento INVENTADA reprova (não pode virar 03/03)', () => {
    // 1971-02-31 não existe; `new Date` rolava para 1971-03-03 e gravava uma
    // data de nascimento falsa, que depois alimenta idade e percentis da OMS.
    for (const lixo of ['1971-02-31', '2020-13-01', '1971-2-31', 'abc', '31/02/1971']) {
      expect(profileSchema.safeParse({ fullName: 'João Pereira', dateOfBirth: lixo }).success, `deveria reprovar: ${lixo}`).toBe(false);
    }
  });

  it('(d) data de nascimento no FUTURO continua reprovando', () => {
    const futuro = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    const r = profileSchema.safeParse({ fullName: 'João Pereira', dateOfBirth: futuro });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.find((i) => i.path[0] === 'dateOfBirth')?.message).toBe('Data de nascimento no futuro.');
    }
    // string ISO no futuro também
    const iso = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(profileSchema.safeParse({ fullName: 'João Pereira', dateOfBirth: iso }).success).toBe(false);
  });

  it('(e) data de nascimento válida passa e sai como Date', () => {
    const r = profileSchema.safeParse({ fullName: 'João Pereira', dateOfBirth: '1971-02-28' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dateOfBirth).toBeInstanceOf(Date);
      expect(r.data.dateOfBirth?.toISOString().slice(0, 10)).toBe('1971-02-28');
    }
  });

  it('(f) a mensagem de data inválida está em PORTUGUÊS', () => {
    const r = profileSchema.safeParse({ fullName: 'João Pereira', dateOfBirth: 'abc' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.find((i) => i.path[0] === 'dateOfBirth')?.message ?? '';
      expect(msg).toBe('Data de nascimento inválida.');
      expect(msg).not.toMatch(/invalid/i);
    }
  });

  it('(g) altura VAZIA passa e sai como undefined', () => {
    for (const entrada of ['', '   ', null, undefined]) {
      const r = profileSchema.safeParse({ fullName: 'João Pereira', heightCm: entrada });
      expect(r.success, `entrada: ${JSON.stringify(entrada)}`).toBe(true);
      if (r.success) expect(r.data.heightCm).toBeUndefined();
    }
  });

  it('(h) altura preenchida passa e sai como número', () => {
    const r = profileSchema.safeParse({ fullName: 'João Pereira', heightCm: '170' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.heightCm).toBe(170);
  });

  it('(i) altura absurda continua reprovando, em português', () => {
    for (const lixo of ['0', '-5', '999', 'abc']) {
      const r = profileSchema.safeParse({ fullName: 'João Pereira', heightCm: lixo });
      expect(r.success, `deveria reprovar: ${lixo}`).toBe(false);
      if (!r.success) {
        expect(r.error.issues.find((i) => i.path[0] === 'heightCm')?.message).toMatch(/^Altura/);
      }
    }
  });

  it('(j) altura com vírgula decimal (padrão brasileiro) é entendida', () => {
    const r = profileSchema.safeParse({ fullName: 'João Pereira', heightCm: '170,5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.heightCm).toBe(170.5);
  });

  it('(k) o campo obrigatório não foi afrouxado', () => {
    expect(profileSchema.safeParse({ fullName: '', dateOfBirth: '', heightCm: '' }).success).toBe(false);
  });
});
