'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ATIVIDADE FÍSICA — registrar e listar
 * ════════════════════════════════════════════════════════════════════════════
 *
 * O idealizador do produto tem revascularização do miocárdio e hipertensão
 * essencial. Toda decisão desta tela foi tomada pensando nele abrindo o app
 * depois da caminhada de terça — e é por isso que ela é AVARENTA no que diz:
 *
 * 1. O APP NÃO PRESCREVE. Não sugere exercício, não monta treino, não propõe
 *    duração, não diz se o que a pessoa fez "foi bom". Ele registra e organiza;
 *    quem interpreta é a equipe de saúde. Um app que dissesse "hoje você
 *    caminhou pouco" para quem revascularizou estaria opinando sobre conduta
 *    cardiológica sem ter examinado ninguém.
 *
 * 2. A OMS É CITAÇÃO COM FONTE, NUNCA META DO APP. Os 150 min/semana aparecem
 *    escritos, com o nome da diretriz e o ano, e com a frase que separa
 *    "referência de saúde pública" de "alvo que este app definiu para você".
 *    Nenhuma barra enche, nenhuma porcentagem é calculada. Ver `ResumoSemana`.
 *
 * 3. A SEMANA CONTA REGISTRO, NÃO ADERÊNCIA. Sem sequência, sem ofensiva, sem
 *    recorde, sem "parabéns". É o precedente do diário alimentar (05/08/2026):
 *    diário que pontua assiduidade vira obrigação, e obrigação em registro de
 *    saúde faz a pessoa parar de registrar — ou registrar o que fica bonito.
 *
 * 4. VERACIDADE. "Nenhuma atividade registrada" só com a consulta CONFIRMADA
 *    (`estadoSecao`). Enquanto isso, esqueleto; se falhou, o erro e o caminho de
 *    volta. Mesmo padrão de `(app)/medicamentos/page.tsx`.
 *
 * 5. NENHUMA COR JULGA O CORPO. Verde/âmbar/vermelho são do SISTEMA e nunca do
 *    esforço, da duração ou da frequência da pessoa. As linhas usam a paleta de
 *    CATEGORIA do design system.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A MIGRAÇÃO 0050 PODE AINDA NÃO ESTAR APLICADA
 *
 * Entre publicar o app e aplicar a migration existe uma janela real em que
 * `public.activity_sessions` não existe. As queries do pacote NÃO engolem esse
 * erro devolvendo `[]` — se devolvessem, esta tela escreveria "nenhuma
 * atividade registrada" sobre um dado que ninguém leu.
 *
 * Então o erro sobe, e aqui ele é separado em dois casos:
 *  · `isActivityModuleUnavailable(error)` → é "o recurso ainda não está no ar".
 *    A tela mostra `ATIVIDADE_INDISPONIVEL_TEXTO`, um texto calmo, e ESCONDE o
 *    formulário: oferecer um botão "Salvar" que vai falhar de novo é pior que
 *    explicar. Nada de stack trace, nada de "erro 42P01".
 *  · qualquer outro erro → falha de leitura comum, com "tentar de novo".
 */

import { useMemo, useState } from 'react';
import { Footprints, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  diaLocal,
  estadoSecao,
  semanaDe,
  type ActivitySessionInput,
} from '@hubpatients/core';
import {
  isActivityModuleUnavailable,
  useActivityMutations,
  useActivitySessions,
  ATIVIDADE_INDISPONIVEL_TEXTO,
  type ActivitySession,
} from '@hubpatients/supabase';
import { useActiveProfile } from '@/components/profile-context';
import { PageHeader, PanelCard, SectionHeader } from '@/components/ui/painel';
import { FormularioAtividade } from '@/components/activity/formulario-atividade';
import { ListaAtividades } from '@/components/activity/lista-atividades';
import { ResumoSemana } from '@/components/activity/resumo-semana';

/**
 * Em que DIA esta sessão conta?
 *
 * Se a pessoa informou a data, é a data dela — `performed_at` é `date` e já
 * chega como `AAAA-MM-DD`, o mesmo formato que o resto do app usa para "dia".
 * Se não informou, cai no dia LOCAL em que o registro foi anotado.
 *
 * `occurred_at` não serve para isto: ela guarda o dia informado como meia-noite
 * UTC, e lê-lo em horário local devolve o dia ANTERIOR no Brasil — a caminhada
 * de segunda sumiria do total desta semana e apareceria na passada.
 */
function diaDaSessao(sessao: ActivitySession): string {
  if (sessao.performed_at) return sessao.performed_at;
  const anotado = new Date(sessao.created_at);
  return Number.isNaN(anotado.getTime()) ? '' : diaLocal(anotado);
}

/** A sessão caiu dentro desta semana? Comparação de `AAAA-MM-DD`, não de `Date`. */
function naSemana(sessao: ActivitySession, inicio: string, fim: string): boolean {
  const dia = diaDaSessao(sessao);
  return dia !== '' && dia >= inicio && dia <= fim;
}

export default function AtividadeFisicaPage() {
  const { patientId, isPatientKnown } = useActiveProfile();
  const sessoesQuery = useActivitySessions(patientId || undefined);
  const { criar, excluir } = useActivityMutations(patientId);

  /*
   * A ÚNICA porta para "nenhuma atividade registrada". Com `patientId` vazio a
   * consulta fica `enabled: false` e, no React Query v5, `isLoading` e
   * `isError` são `false` AO MESMO TEMPO — as duas travas habituais caem juntas.
   * `sujeitoConhecido` é o terceiro estado que falta nas flags.
   */
  const estado = estadoSecao({
    sujeitoConhecido: isPatientKnown,
    isSuccess: sessoesQuery.isSuccess,
    isError: sessoesQuery.isError,
  });

  // O módulo ainda não foi liberado neste banco (0050 não aplicada)?
  const moduloIndisponivel =
    sessoesQuery.isError && isActivityModuleUnavailable(sessoesQuery.error);

  const sessoes = useMemo(() => sessoesQuery.data ?? [], [sessoesQuery.data]);

  const semana = useMemo(() => semanaDe(diaLocal()), []);
  const inicioSemana = semana[0] ?? '';
  const fimSemana = semana[6] ?? '';
  const daSemana = useMemo(
    () =>
      inicioSemana && fimSemana
        ? sessoes.filter((s) => naSemana(s, inicioSemana, fimSemana))
        : [],
    [sessoes, inicioSemana, fimSemana],
  );

  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  /** Traduz uma falha de escrita em uma frase, sem jargão e sem culpar ninguém. */
  function avisarFalha(erro: unknown, padrao: string) {
    toast.error(isActivityModuleUnavailable(erro) ? ATIVIDADE_INDISPONIVEL_TEXTO : padrao);
  }

  async function salvar(valores: ActivitySessionInput): Promise<boolean> {
    if (!patientId) {
      toast.error('Ainda estamos carregando seu perfil. Tente de novo em instantes.');
      return false;
    }
    try {
      await criar.mutateAsync(valores);
      toast.success('Atividade registrada.');
      return true;
    } catch (erro) {
      avisarFalha(erro, 'Não foi possível salvar agora. Nada foi registrado.');
      return false;
    }
  }

  async function apagar(sessao: ActivitySession) {
    setExcluindoId(sessao.id);
    try {
      await excluir.mutateAsync(sessao.id);
      toast.success('Registro apagado.');
    } catch (erro) {
      avisarFalha(erro, 'Não foi possível apagar agora. O registro continua no seu prontuário.');
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10 hp-page hp-page--wellbeing">
      <PageHeader
        eyebrow="Bem-estar"
        title="Atividade física"
        subtitle="Anote o que você fez, por quanto tempo e o que sentiu durante. O app registra e organiza — quem interpreta é a sua equipe de saúde."
        icon={Footprints}
        tone="turquesa"
      />

      {moduloIndisponivel ? (
        /*
         * Janela entre o deploy e a migração. Texto único do pacote, para a tela
         * não inventar o dela — e sem formulário, porque um "Salvar" que já
         * sabemos que vai falhar é uma promessa quebrada de propósito.
         */
        <PanelCard as="section" aria-labelledby="indisponivel-titulo" className="p-5">
          <SectionHeader
            id="indisponivel-titulo"
            title="Ainda não disponível nesta conta"
            icon={Footprints}
            tone="ardosia"
          />
          <p className="mt-3 text-body leading-relaxed text-fg-soft">
            {ATIVIDADE_INDISPONIVEL_TEXTO}
          </p>
        </PanelCard>
      ) : (
        <>
          <ResumoSemana
            estado={estado}
            sessoes={daSemana}
            inicio={inicioSemana}
            fim={fimSemana}
          />

          <PanelCard as="section" aria-labelledby="registrar-titulo" className="p-5">
            <SectionHeader
              id="registrar-titulo"
              title="Registrar atividade"
              icon={PencilLine}
              tone="turquesa"
            />
            <div className="mt-4">
              <FormularioAtividade onSalvar={salvar} salvando={criar.isPending} />
            </div>
          </PanelCard>

          <section aria-labelledby="lista-titulo" className="space-y-3">
            <SectionHeader
              id="lista-titulo"
              title="Atividades registradas"
              icon={Footprints}
              tone="indigo"
            />
            <ListaAtividades
              estado={estado}
              sessoes={sessoes}
              onExcluir={(s) => void apagar(s)}
              onTentarDeNovo={() => void sessoesQuery.refetch()}
              excluindoId={excluindoId}
            />
          </section>
        </>
      )}

      <p className="text-center text-body-sm text-fg-soft">
        Leve estes registros à sua próxima consulta. 💙
      </p>
    </div>
  );
}
