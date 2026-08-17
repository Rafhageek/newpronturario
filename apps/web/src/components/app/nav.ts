import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  User,
  NotebookPen,
  Pill,
  CalendarDays,
  FlaskConical,
  Footprints,
  LineChart,
  Users,
  Share2,
  UsersRound,
  GraduationCap,
  ShieldCheck,
  CreditCard,
  Settings,
  Baby,
  Blocks,
  Droplets,
  Gavel,
  MapPin,
  Building2,
  Wind,
  Scale,
  Ruler,
  Utensils,
  Target,
  History,
  QrCode,
} from 'lucide-react';

/** Seções temáticas do menu, na ordem de exibição. */
export type NavSection =
  | 'Meu prontuário'
  | 'Bem-estar'
  | 'Jornadas de cuidado'
  | 'Comunidade e serviços'
  | 'Conta e privacidade'
  | 'Equipe';
export const NAV_SECTIONS: NavSection[] = [
  'Meu prontuário',
  'Bem-estar',
  'Jornadas de cuidado',
  'Comunidade e serviços',
  'Conta e privacidade',
  'Equipe',
];

/** Estado real do módulo (reflete o que de fato funciona, não o roteiro). */
export type NavStatus = 'stable' | 'beta' | 'planned';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  /** 'stable' = pronto · 'beta' = funciona, em evolução · 'planned' = em breve. */
  status: NavStatus;
  /** Marca de recurso Plus. */
  plus?: boolean;
  /** Exibição condicional. Filtrado na sidebar conforme o perfil/papel. */
  gate?: 'pregnancy' | 'cycle' | 'staff';
  /**
   * Como a pessoa CHAMA a tela quando procura por ela — não é o nome oficial.
   *
   * Existe por um caso real: o idealizador pediu "coloquem um campo de nutrição"
   * com o Diário alimentar pronto desde julho (tabela TACO, 597 alimentos). A
   * busca do topo casava só `label` + `section`, então "nutrição" não devolvia
   * nada e a tela parecia não existir. O vocabulário de quem usa não é o nosso.
   *
   * Escreva sem acento e em minúsculas: a busca normaliza os dois lados.
   * Nada aqui é sugestão de conduta — são apelidos de tela, não conselhos.
   *
   * A busca (`app-search.tsx`) LÊ este campo desde 2026-08-17 — ele passou uma
   * leva inteira escrito e sem nenhum consumidor, viajando no bundle sem efeito.
   * O fio está travado por `packages/core/src/utils/busca-nav.test.ts`: se
   * alguém tirar os sinônimos do texto pesquisável, ou apagar os termos que o
   * cliente de fato digita, aquele teste reprova.
   */
  sinonimos?: string[];
}

/*
 * ORDEM DENTRO DAS SEÇÕES — o que mudou e por quê (2026-08-17)
 *
 * Os dois diários viviam longe um do outro: "Diário clínico" em Meu prontuário e
 * "Diário alimentar" em Bem-estar, com quatro itens e um cabeçalho de seção
 * entre eles. Para quem usa, os dois são a MESMA tarefa — "contar como foi meu
 * dia" — e a distância no menu fazia o segundo parecer inexistente.
 *
 * A correção aqui é de baixo risco e reversível: NÃO refundamos a taxonomia das
 * 5 seções (isso fica para depois de teste com usuário, já combinado com o
 * cliente). Só reordenamos DENTRO das seções que já existiam, de modo que a
 * lista renderizada fique assim, na sequência:
 *
 *   … Mostrar ao médico · Diário clínico │ BEM-ESTAR │ Diário alimentar ·
 *   Atividade física …
 *
 * Os três registros do dia passam a ser vizinhos, separados apenas pelo
 * cabeçalho da seção. Sem mover nenhum item de seção, sem rota nova de menu.
 */
export const NAV: NavItem[] = [
  // Meu prontuário: tarefas clínicas mais frequentes ficam sempre visíveis.
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard, section: 'Meu prontuário', status: 'stable', sinonimos: ['inicio', 'home', 'painel', 'resumo'] },
  { href: '/linha-do-tempo', label: 'Linha do tempo', icon: History, section: 'Meu prontuário', status: 'stable', sinonimos: ['historico', 'historia clinica'] },
  { href: '/plano-saude', label: 'Plano de saúde', icon: CreditCard, section: 'Meu prontuário', status: 'stable', sinonimos: ['convenio', 'carteirinha', 'operadora'] },
  { href: '/medicamentos', label: 'Medicamentos', icon: Pill, section: 'Meu prontuário', status: 'stable', sinonimos: ['remedio', 'receita', 'bula', 'farmacia'] },
  { href: '/exames', label: 'Exames', icon: FlaskConical, section: 'Meu prontuário', status: 'stable', sinonimos: ['laudo', 'resultado', 'laboratorio', 'sangue'] },
  { href: '/consultas', label: 'Consultas', icon: CalendarDays, section: 'Meu prontuário', status: 'stable', sinonimos: ['agenda', 'medico', 'retorno', 'cardiologista'] },
  { href: '/compartilhar', label: 'Mostrar ao médico', icon: QrCode, section: 'Meu prontuário', status: 'beta', sinonimos: ['compartilhar', 'qr code', 'levar na consulta'] },
  /* Último da seção: encosta no cabeçalho de Bem-estar, onde está o alimentar. */
  { href: '/diario', label: 'Diário clínico', icon: NotebookPen, section: 'Meu prontuário', status: 'stable', sinonimos: ['diario', 'como me senti', 'sintoma', 'dor', 'pressao', 'humor'] },

  // Bem-estar — registros do dia primeiro, medidas e leituras depois.
  { href: '/diario-alimentar', label: 'Diário alimentar', icon: Utensils, section: 'Bem-estar', status: 'beta', sinonimos: ['nutricao', 'nutricional', 'alimentacao', 'comida', 'refeicao', 'dieta', 'caloria', 'kcal', 'macros', 'taco', 'sal', 'sodio'] },
  { href: '/atividade-fisica', label: 'Atividade física', icon: Footprints, section: 'Bem-estar', status: 'beta', sinonimos: ['exercicio', 'caminhada', 'caminhar', 'passos', 'bicicleta', 'hidroginastica', 'academia', 'movimento'] },
  { href: '/analise', label: 'Indicadores', icon: LineChart, section: 'Bem-estar', status: 'beta', sinonimos: ['grafico', 'evolucao', 'analise', 'numeros'] },
  { href: '/composicao-corporal', label: 'Composição corporal', icon: Scale, section: 'Bem-estar', status: 'beta', sinonimos: ['peso', 'balanca', 'imc', 'gordura', 'massa magra'] },
  { href: '/circunferencias', label: 'Circunferências', icon: Ruler, section: 'Bem-estar', status: 'beta', sinonimos: ['medidas', 'cintura', 'quadril', 'fita metrica'] },
  { href: '/metas', label: 'Metas', icon: Target, section: 'Bem-estar', status: 'beta', sinonimos: ['objetivo', 'meta que eu defini'] },
  { href: '/respirar', label: 'Respirar', icon: Wind, section: 'Bem-estar', status: 'stable', sinonimos: ['respiracao', 'calma', 'ansiedade', 'relaxar'] },

  // Jornadas de cuidado
  { href: '/gestacao', label: 'Gestação', icon: Baby, section: 'Jornadas de cuidado', status: 'stable', gate: 'pregnancy', sinonimos: ['gravidez', 'pre natal', 'bebe'] },
  { href: '/ciclo', label: 'Ciclo', icon: Droplets, section: 'Jornadas de cuidado', status: 'stable', gate: 'cycle', sinonimos: ['menstruacao', 'periodo', 'tpm'] },
  { href: '/criancas', label: 'Crianças', icon: Blocks, section: 'Jornadas de cuidado', status: 'stable', sinonimos: ['filho', 'filha', 'neto', 'pediatra', 'vacina', 'crescimento'] },

  // Comunidade e serviços
  { href: '/locais/pharmacy', label: 'Locais de saúde', icon: MapPin, section: 'Comunidade e serviços', status: 'stable', sinonimos: ['farmacia', 'ubs', 'posto de saude', 'hospital', 'perto de mim'] },
  { href: '/familia', label: 'Família', icon: UsersRound, section: 'Comunidade e serviços', status: 'stable', sinonimos: ['cuidador', 'dependente', 'esposa', 'marido', 'acesso'] },
  { href: '/comunidade', label: 'Comunidade', icon: Users, section: 'Comunidade e serviços', status: 'stable', sinonimos: ['forum', 'grupo', 'conversar'] },
  { href: '/rede-social', label: 'Rede social', icon: Share2, section: 'Comunidade e serviços', status: 'beta', sinonimos: ['amigos', 'perfil publico'] },
  { href: '/educacao', label: 'Conteúdos de saúde', icon: GraduationCap, section: 'Comunidade e serviços', status: 'beta', sinonimos: ['artigo', 'aprender', 'curso', 'ler'] },

  // Conta e privacidade
  { href: '/perfil', label: 'Perfil', icon: User, section: 'Conta e privacidade', status: 'stable', sinonimos: ['meus dados', 'condicao', 'doenca', 'diagnostico', 'cid', 'cid-10', 'alergia', 'cirurgia', 'tipo sanguineo'] },
  { href: '/consentimento', label: 'Dados e privacidade', icon: ShieldCheck, section: 'Conta e privacidade', status: 'stable', sinonimos: ['lgpd', 'consentimento', 'apagar meus dados', 'exportar'] },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, section: 'Conta e privacidade', status: 'stable', sinonimos: ['ajustes', 'letra maior', 'modo senior', 'contraste', 'tema escuro'] },
  /*
   * Plano e Assinatura estão OCULTOS, não removidos: o app inteiro foi liberado
   * (migração 0043 — `has_plus_access()` devolve true). As rotas continuam
   * existindo e funcionando; para voltar a cobrar, descomentar aqui e restaurar
   * a função no banco (o passo a passo está no cabeçalho da 0043).
   * { href: '/planos', label: 'Plano e benefícios', icon: Sparkles, section: 'Conta e privacidade', status: 'stable', plus: true },
   * { href: '/assinatura', label: 'Assinatura e cobrança', icon: CreditCard, section: 'Conta e privacidade', status: 'beta' },
   * (ao restaurar, reimportar `Sparkles` e `CreditCard` de lucide-react)
   */

  // Equipe
  { href: '/moderacao', label: 'Moderação', icon: Gavel, section: 'Equipe', status: 'stable', gate: 'staff' },
  { href: '/admin/locais', label: 'Locais (admin)', icon: Building2, section: 'Equipe', status: 'stable', gate: 'staff' },
];
