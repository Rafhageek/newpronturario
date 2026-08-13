/**
 * Sinônimos populares → categorias da CID-10.
 *
 * PROCEDÊNCIA (honestidade de dados — leia junto com o cabeçalho de `cid10-br.ts`):
 *   • os CÓDIGOS e as DESCRIÇÕES continuam sendo os oficiais do DATASUS, extraídos
 *     do arquivo original e NUNCA reescritos aqui;
 *   • os TERMOS desta lista são CURADORIA NOSSA. Não são terminologia oficial, não
 *     saíram de nenhum arquivo do Ministério da Saúde e não constam da CID-10.
 *     São o vocabulário que o paciente brasileiro realmente digita.
 *
 * O QUE ESTE ARQUIVO É: uma CHAVE DE BUSCA. O sinônimo serve só para o item
 * oficial aparecer na lista. O que a pessoa vê e o que fica gravado no prontuário
 * é sempre o CÓDIGO e a DESCRIÇÃO OFICIAL, sem alteração. Nenhum termo daqui é
 * exibido como se fosse nome de doença.
 *
 * ⚠️ REGRA 1 DO PRODUTO (o app registra, não diagnostica) aplicada a este arquivo:
 *   • VALE: traduzir vocabulário — a pessoa já sabe o que tem e só não escreve
 *     como o DATASUS escreve ("pressão alta" = "Hipertensão essencial (primária)").
 *   • VALE: apontar o termo popular para a categoria de 3 dígitos que oficialmente
 *     o CONTÉM ("labirintite" está dentro de H81; esta base só tem 3 dígitos).
 *   • VALE: resolver falha de morfologia — a palavra existe na descrição oficial,
 *     mas grudada em outra ("tireoide" dentro de "hipotireoidismos").
 *   • NÃO VALE: sintoma/queixa → doença. "Dor no peito" não vira angina, "azia"
 *     não vira refluxo, "tontura" não vira labirintite. Isso seria diagnosticar.
 *   • NÃO VALE: termo ambíguo que leve a doenças diferentes e sem parentesco
 *     ("reumatismo", "tumor"). Na dúvida, fica de fora: o campo aceita texto
 *     livre, então sinônimo faltando custa pouco e sinônimo errado custa muito.
 *
 * Quando um termo aponta para mais de um código, todos são da MESMA família
 * (tipos da mesma doença ou o mesmo órgão), a ordem é a de maior probabilidade
 * de uso, e quem escolhe é sempre a pessoa — o app não decide por ela.
 *
 * Curadoria revisada em: 2026-08-13.
 */

export interface Cid10Sinonimo {
  /** Termo como o paciente escreve. Comparado sem acento e sem caixa. */
  termo: string;
  /** Categorias oficiais que o termo ajuda a ENCONTRAR (ordem = ordem de exibição). */
  codigos: readonly string[];
  /** Por que este mapeamento é vocabulário, e não diagnóstico. */
  motivo: string;
}

export const CID10_SINONIMOS: readonly Cid10Sinonimo[] = [
  // ── Metabólicas ────────────────────────────────────────────────────────────
  {
    termo: 'colesterol',
    codigos: ['E78'],
    motivo:
      'Colesterol alto é o nome popular do que o DATASUS chama de distúrbio do metabolismo de lipoproteínas (E78.0 é hipercolesterolemia pura).',
  },
  {
    termo: 'colesterol alto',
    codigos: ['E78'],
    motivo: 'Mesma tradução de vocabulário de "colesterol".',
  },
  {
    termo: 'dislipidemia',
    codigos: ['E78'],
    motivo:
      'Termo clínico corrente para as lipidemias de E78; não aparece com essa grafia na descrição oficial.',
  },
  {
    termo: 'triglicerides',
    codigos: ['E78'],
    motivo: 'Hipertrigliceridemia pura é E78.1, dentro da mesma categoria de 3 dígitos.',
  },
  {
    termo: 'triglicerideos',
    codigos: ['E78'],
    motivo: 'Grafia alternativa de triglicérides, que é a hipertrigliceridemia pura de E78.1.',
  },
  {
    termo: 'gordura no sangue',
    codigos: ['E78'],
    motivo: 'Nome popular das lipidemias (E78). É como a pessoa chama o que já está no laudo dela.',
  },
  {
    termo: 'acucar no sangue',
    codigos: ['R73', 'E11', 'E10', 'E14'],
    motivo:
      'Vocabulário de glicemia. R73 ("Aumento da glicemia") vem primeiro porque é o termo oficial equivalente; os tipos de diabetes vêm depois para quem já tem o diagnóstico. O app não escolhe — mostra e a pessoa marca o que está no papel dela.',
  },
  {
    termo: 'acucar alto',
    codigos: ['R73', 'E11', 'E10', 'E14'],
    motivo: 'Mesma tradução de vocabulário de "açúcar no sangue", com a mesma ordem de exibição.',
  },
  {
    termo: 'diabetis',
    codigos: ['E11', 'E10', 'E14'],
    motivo: 'Grafia popular de diabetes; sem isto a busca por "diabetis" não acha nada.',
  },
  {
    termo: 'acido urico',
    codigos: ['E79'],
    motivo:
      'Hiperuricemia sem sinais de artrite é E79.0. Não aponta para gota (M10) — isso exigiria saber se houve crise, e seria diagnóstico.',
  },
  {
    termo: 'hipoglicemia',
    codigos: ['E16'],
    motivo: 'Hipoglicemia é E16.0-E16.2, dentro da categoria E16.',
  },
  {
    termo: 'tireoide',
    codigos: ['E03', 'E05'],
    motivo:
      'A palavra existe nas descrições oficiais, grudada ("hipoTIREOIDismos", "hiperTIREOIDismo"), então a busca por substring não achava. Os dois são transtornos da tireoide e a pessoa reconhece o dela.',
  },
  {
    termo: 'problema de tireoide',
    codigos: ['E03', 'E05'],
    motivo: 'Mesma tradução de "tireoide": a palavra existe só grudada nas descrições oficiais.',
  },

  // ── Circulatórias ──────────────────────────────────────────────────────────
  {
    termo: 'pressao alta',
    codigos: ['I10'],
    motivo:
      'Nome popular da hipertensão essencial (I10). É tradução de linguagem: quem digita isso já tem o diagnóstico.',
  },
  {
    termo: 'pressao arterial alta',
    codigos: ['I10'],
    motivo: 'Mesma tradução de vocabulário de "pressão alta" (I10), escrita por extenso.',
  },
  {
    termo: 'hipertenso',
    codigos: ['I10'],
    motivo:
      'Forma como a pessoa se descreve; a descrição oficial traz o substantivo ("Hipertensão").',
  },
  {
    termo: 'pressao baixa',
    codigos: ['I95'],
    motivo: 'Nome popular de hipotensão (I95); a descrição oficial só traz o termo técnico.',
  },
  {
    termo: 'avc',
    codigos: ['I64'],
    motivo:
      'Sigla de acidente vascular cerebral. Aponta para I64 ("não especificado como hemorrágico ou isquêmico") justamente porque dizer o tipo seria diagnosticar.',
  },
  {
    termo: 'derrame',
    codigos: ['I64'],
    motivo: 'Nome popular de AVC, com o mesmo cuidado: só a categoria não especificada.',
  },
  {
    termo: 'ataque cardiaco',
    codigos: ['I21'],
    motivo:
      'Nome popular de infarto agudo do miocárdio (I21). Só serve para quem registra um infarto que já aconteceu.',
  },

  // ── Ouvido, olho ───────────────────────────────────────────────────────────
  {
    termo: 'labirintite',
    codigos: ['H81'],
    motivo:
      'Labirintite é H81.2/H81.3, dentro de "Transtornos da função vestibular". A palavra não aparece na descrição de 3 dígitos.',
  },
  {
    termo: 'surdez',
    codigos: ['H91', 'H90'],
    motivo:
      'Nome popular de perda de audição; as duas categorias são exatamente isso e a pessoa marca a que está no laudo.',
  },
  {
    termo: 'vista cansada',
    codigos: ['H52'],
    motivo:
      'Nome popular de presbiopia (H52.4), dentro de "Transtornos da refração e da acomodação".',
  },

  // ── Osteomusculares ────────────────────────────────────────────────────────
  {
    termo: 'bico de papagaio',
    codigos: ['M47'],
    motivo: 'Nome popular de espondilose (M47) — é a mesma coisa dita de outro jeito.',
  },
  {
    termo: 'artrose',
    codigos: ['M19', 'M16', 'M17', 'M15'],
    motivo:
      'A palavra está nas quatro descrições oficiais (inclusive grudada em "Poliartrose"). Reúne a família e deixa a pessoa escolher a articulação que consta no laudo dela.',
  },
  {
    termo: 'hernia de disco',
    codigos: ['M51', 'M50'],
    motivo:
      'Deslocamento de disco intervertebral é M51.1/M51.2 (lombar) e M50.1 (cervical). As duas categorias são de disco; a pessoa sabe qual é a sua.',
  },
  {
    termo: 'lombalgia',
    codigos: ['M54'],
    motivo:
      'Lombalgia é M54.5, dentro de "Dorsalgia" — termo clínico para termo clínico, sem inferir causa.',
  },
  {
    termo: 'fibromialgia',
    codigos: ['M79'],
    motivo:
      'Fibromialgia é M79.7, dentro de "Outros transtornos dos tecidos moles". Nome já diagnosticado, não queixa.',
  },

  // ── Mentais e do sono ──────────────────────────────────────────────────────
  {
    termo: 'depressao',
    codigos: ['F32', 'F33'],
    motivo:
      'A descrição oficial usa o adjetivo ("Episódios depressivos"), então o substantivo não achava nada. As duas categorias são depressão.',
  },
  {
    termo: 'ansiedade',
    codigos: ['F41', 'F40'],
    motivo:
      'A descrição oficial usa "ansiosos"; o substantivo não casava. F41 é onde está a ansiedade generalizada (F41.1).',
  },
  {
    termo: 'sindrome do panico',
    codigos: ['F41'],
    motivo: 'Transtorno de pânico é F41.0, dentro de F41.',
  },
  {
    termo: 'panico',
    codigos: ['F41'],
    motivo: 'Forma curta de "síndrome do pânico" (F41.0).',
  },
  {
    termo: 'insonia',
    codigos: ['G47'],
    motivo:
      'Insônia é G47.0, dentro de "Distúrbios do sono". Não aponta para F51 porque separar orgânico de emocional seria diagnóstico.',
  },
  {
    termo: 'apneia do sono',
    codigos: ['G47'],
    motivo: 'Apneia de sono é G47.3, dentro de "Distúrbios do sono".',
  },

  // ── Digestivas e urinárias ─────────────────────────────────────────────────
  {
    termo: 'pedra na vesicula',
    codigos: ['K80'],
    motivo: 'Nome popular de colelitíase (K80) — mesma coisa, outra palavra.',
  },
  {
    termo: 'pedra no rim',
    codigos: ['N20'],
    motivo:
      'Termo clínico corrente para N20, cuja descrição oficial diz "Calculose do rim e do ureter".',
  },
  {
    termo: 'calculo renal',
    codigos: ['N20'],
    motivo: 'Termo clínico corrente para N20; a descrição oficial diz "Calculose".',
  },
  {
    termo: 'gordura no figado',
    codigos: ['K76'],
    motivo: 'Degeneração gordurosa do fígado é K76.0, dentro de "Outras doenças do fígado".',
  },
  {
    termo: 'esteatose',
    codigos: ['K76'],
    motivo: 'Palavra que costuma vir escrita no laudo de ultrassom para a mesma K76.0.',
  },
  {
    termo: 'prostata aumentada',
    codigos: ['N40'],
    motivo: 'Nome popular de hiperplasia da próstata (N40).',
  },
  {
    termo: 'bexiga caida',
    codigos: ['N81'],
    motivo: 'Nome popular de prolapso genital (N81.1 é cistocele).',
  },
  {
    termo: 'utero caido',
    codigos: ['N81'],
    motivo: 'Nome popular de prolapso uterino (N81.2-N81.4).',
  },
  {
    termo: 'mioma',
    codigos: ['D25'],
    motivo:
      'A palavra está grudada na descrição oficial ("Leiomioma do útero"), então a busca por início de palavra não achava.',
  },

  // ── Respiratórias ──────────────────────────────────────────────────────────
  {
    termo: 'dpoc',
    codigos: ['J44'],
    motivo: 'Sigla de doença pulmonar obstrutiva crônica — é literalmente a descrição de J44.',
  },

  // ── Infecciosas e de pele ──────────────────────────────────────────────────
  {
    termo: 'cobreiro',
    codigos: ['B02'],
    motivo: 'Nome popular de herpes zoster (B02); a palavra "cobreiro" não existe na base oficial.',
  },
  {
    termo: 'micose',
    codigos: ['B35'],
    motivo: 'Nome popular de dermatofitose (B35); ninguém procura pelo termo técnico.',
  },
  {
    termo: 'frieira',
    codigos: ['B35'],
    motivo: 'Nome popular de tinha do pé (B35.3), dentro da categoria B35.',
  },
  {
    termo: 'aids',
    codigos: ['B20'],
    motivo: 'A descrição oficial traz a sigla HIV, não AIDS.',
  },

  // ── Neoplasias (só as sem ambiguidade de órgão) ────────────────────────────
  {
    termo: 'cancer de mama',
    codigos: ['C50'],
    motivo:
      'A descrição oficial diz "Neoplasia maligna da mama"; a palavra "câncer" não aparece em lugar nenhum da base.',
  },
  {
    termo: 'cancer de seio',
    codigos: ['C50'],
    motivo: 'Mesma tradução de "câncer de mama" (C50), com a palavra que se usa em casa.',
  },
  {
    termo: 'cancer de prostata',
    codigos: ['C61'],
    motivo: 'Traduz "Neoplasia maligna da próstata", que a pessoa nunca digitaria assim.',
  },
  {
    termo: 'cancer de pulmao',
    codigos: ['C34'],
    motivo: 'Traduz "Neoplasia maligna dos brônquios e dos pulmões".',
  },
  {
    termo: 'cancer de intestino',
    codigos: ['C18', 'C20'],
    motivo:
      'Intestino grosso cobre cólon (C18) e reto (C20); as duas são do mesmo órgão e a pessoa marca a do laudo.',
  },
  {
    termo: 'cancer de colo do utero',
    codigos: ['C53'],
    motivo: 'Traduz "Neoplasia maligna do colo do útero".',
  },
  {
    termo: 'cancer de pele',
    codigos: ['C43', 'C44'],
    motivo:
      'As duas descrições oficiais são de pele; melanoma ou não é o que está escrito no laudo, não algo que o app decida.',
  },
  {
    termo: 'cancer de bexiga',
    codigos: ['C67'],
    motivo: 'Traduz "Neoplasia maligna da bexiga", que a pessoa nunca digitaria assim.',
  },
  {
    termo: 'cancer de tireoide',
    codigos: ['C73'],
    motivo: 'Traduz "Neoplasia maligna da glândula tireóide".',
  },
];

/**
 * Termos que a auditoria considerou e que ficaram DELIBERADAMENTE de fora.
 *
 * Está aqui porque a decisão de não mapear é tão importante quanto a de mapear:
 * evita que alguém "conserte" a lista depois sem saber por que o termo faltava.
 * O campo aceita texto livre — nenhuma destas condições fica impossível de
 * registrar, elas só não ganham atalho.
 */
export const CID10_SINONIMOS_RECUSADOS: readonly { termo: string; motivo: string }[] = [
  {
    termo: 'azia',
    motivo:
      'Sintoma. Levaria a refluxo (K21) ou dispepsia (K30) — isso é diagnóstico, não vocabulário.',
  },
  {
    termo: 'dor no peito',
    motivo: 'Sintoma. Levaria a angina (I20) ou infarto (I21). Proibido pela regra 1.',
  },
  {
    termo: 'dor nas costas',
    motivo:
      'Queixa. Mesmo "Dorsalgia" (M54) sendo próximo, quem chega com queixa não está registrando condição.',
  },
  {
    termo: 'dor de cabeca',
    motivo: 'Queixa. Levaria a enxaqueca (G43) ou cefaléia (R51) — a primeira seria diagnóstico.',
  },
  {
    termo: 'tontura',
    motivo: 'Sintoma. Levaria a labirintite (H81), que é exatamente o salto proibido.',
  },
  {
    termo: 'cansaco',
    motivo: 'Sintoma inespecífico: anemia, insuficiência cardíaca, hipotireoidismo, depressão.',
  },
  { termo: 'falta de ar', motivo: 'Sintoma. Levaria a asma, DPOC ou insuficiência cardíaca.' },
  { termo: 'inchaco', motivo: 'Sintoma. Levaria a edema, insuficiência cardíaca ou renal.' },
  { termo: 'zumbido', motivo: 'Sintoma auditivo; não é a condição em si.' },
  {
    termo: 'reumatismo',
    motivo:
      'Ambíguo: no Brasil serve para artrite reumatoide, artrose e fibromialgia ao mesmo tempo. Sem parentesco suficiente para uma lista honesta.',
  },
  { termo: 'tumor', motivo: 'Ambíguo: benigno ou maligno, e de qualquer órgão.' },
  {
    termo: 'cancer',
    motivo:
      'Sozinho não vira mapeamento próprio: seria escolher um órgão pela pessoa. Só entram os "câncer de <órgão>", inequívocos — e quem digita só "câncer" alcança essa família inteira pela própria busca, para escolher o órgão que está no laudo.',
  },
  {
    termo: 'prisao de ventre',
    motivo:
      'Queixa. Levaria a K59, e a pessoa que registra constipação como condição escreve o nome dela.',
  },
  {
    termo: 'bronquite cronica',
    motivo:
      'A categoria oficial dela (J41/J42) não está neste recorte; apontar para J44 (DPOC) seria recodificar por conta própria.',
  },
  { termo: 'enfisema', motivo: 'A categoria oficial (J43) não está neste recorte.' },
];
