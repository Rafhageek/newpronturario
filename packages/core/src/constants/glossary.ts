/** Glossário de termos técnicos → definição leiga (tooltips na Educação). */
export const GLOSSARY: Record<string, string> = {
  sistólica: 'O número "de cima" da pressão: a força do sangue quando o coração bate.',
  diastólica: 'O número "de baixo" da pressão: a força do sangue quando o coração relaxa.',
  glicemia: 'A quantidade de açúcar (glicose) no sangue.',
  hba1c: 'Hemoglobina glicada: mostra a média do açúcar no sangue dos últimos ~3 meses.',
  ldl: 'O colesterol que pode se acumular nas artérias (popularmente, o "ruim").',
  hdl: 'O colesterol que ajuda a limpar as artérias (popularmente, o "bom").',
  triglicerides: 'Um tipo de gordura no sangue, ligado à alimentação e ao metabolismo.',
  tsh: 'Hormônio que comanda a tireoide; ajuda a avaliar se ela está funcionando bem.',
  imc: 'Índice de Massa Corporal: relação entre peso e altura, usada como referência.',
  'cid-10': 'Código internacional que nomeia doenças e condições de saúde.',
  spo2: 'Saturação de oxigênio: o quanto de oxigênio o sangue está carregando.',
  ains: 'Anti-inflamatórios não esteroides (ex.: ibuprofeno).',
  ambulatorial: 'Atendimento sem internação, como em consultório ou clínica.',
};

/** Procura a definição de um termo (case-insensitive). */
export function lookupGlossary(term: string): string | undefined {
  return GLOSSARY[term.toLowerCase().trim()];
}
