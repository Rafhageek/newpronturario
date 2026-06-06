-- Seed: conteúdo educativo (health_content)
-- ATENÇÃO: conteúdo educativo curado para MVP. Apenas informativo — NÃO substitui
-- avaliação médica. Deve ser revisado por profissional de saúde antes de produção.

insert into public.health_content (title, body, tags, reading_minutes, source, source_url)
values
  (
    'Entendendo a hipertensão',
    'A hipertensão, conhecida como pressão alta, acontece quando a força do sangue contra as paredes das artérias fica elevada por muito tempo. Na maioria das vezes não causa sintomas, por isso é chamada de "inimiga silenciosa".

Hábitos saudáveis ajudam a manter a pressão sob controle: reduzir o sal, comer mais frutas e verduras, praticar atividade física com regularidade, evitar o cigarro e o excesso de álcool e cuidar do sono e do estresse.

Medir a pressão de tempos em tempos é uma forma simples de se cuidar. Converse sempre com seu médico antes de mudar hábitos ou qualquer medicação, pois cada pessoa é única.',
    '{I10}', 3, 'Sociedade Brasileira de Cardiologia (SBC)', 'https://www.cardiol.br'
  ),
  (
    'Convivendo com o diabetes tipo 2',
    'No diabetes tipo 2, o corpo tem dificuldade de usar bem a insulina, o hormônio que ajuda o açúcar do sangue a entrar nas células. Com o tempo, a glicose pode ficar mais alta do que o ideal.

A boa notícia é que pequenos hábitos fazem muita diferença: alimentação equilibrada com menos açúcar e ultraprocessados, movimento no dia a dia, sono adequado e acompanhamento regular ajudam bastante.

Manter um peso saudável e não fumar também contribuem. Converse sempre com seu médico sobre o seu caso e siga as orientações de quem acompanha a sua saúde.',
    '{E11}', 3, 'Sociedade Brasileira de Diabetes (SBD)', 'https://diabetes.org.br'
  ),
  (
    'O que é o diabetes tipo 1',
    'O diabetes tipo 1 costuma surgir na infância ou juventude, quando o corpo deixa de produzir insulina. Por isso, quem tem essa condição precisa repor a insulina para manter a glicose equilibrada.

Com informação e rotina, é totalmente possível viver bem. Monitorar a glicose, manter horários de alimentação, praticar atividades e contar com apoio de familiares e da equipe de saúde fazem parte do cuidado.

Cada pessoa responde de um jeito, então o plano é sempre individual. Converse sempre com seu médico e a equipe que acompanha você para ajustar o cuidado às suas necessidades.',
    '{E10}', 3, 'Sociedade Brasileira de Diabetes (SBD)', 'https://diabetes.org.br'
  ),
  (
    'Colesterol alto: o que saber',
    'O colesterol é uma gordura importante para o corpo, mas em excesso no sangue pode se acumular nas artérias ao longo do tempo. Existe o colesterol "bom" (HDL) e o "ruim" (LDL), e o equilíbrio entre eles importa.

Hábitos que ajudam: preferir alimentos naturais, reduzir frituras e ultraprocessados, incluir fibras, frutas e verduras, manter-se ativo e evitar o cigarro. Pequenas mudanças somam muito.

Exames de rotina ajudam a acompanhar seus níveis. Converse sempre com seu médico para entender seus resultados e definir, em conjunto, o melhor caminho para você.',
    '{E78}', 3, 'Sociedade Brasileira de Cardiologia (SBC)', 'https://www.cardiol.br'
  ),
  (
    'Asma: respirar com mais tranquilidade',
    'A asma é uma condição em que as vias respiratórias ficam mais sensíveis e podem inflamar, causando tosse, chiado no peito e falta de ar em alguns momentos.

Conhecer o que costuma desencadear as crises — como poeira, fumaça, mofo ou ar muito frio — ajuda a evitá-las. Manter a casa arejada e limpa e não fumar perto de casa também fazem diferença.

Com acompanhamento adequado, a maioria das pessoas leva uma vida ativa e tranquila. Converse sempre com seu médico para entender seu caso e ter um plano de cuidado feito para você.',
    '{J45}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Entendendo a ansiedade',
    'Sentir ansiedade faz parte da vida. Ela se torna um sinal de atenção quando é muito frequente, intensa ou atrapalha o dia a dia, o sono ou os relacionamentos.

Algumas práticas podem trazer alívio: respiração calma, atividade física, contato com pessoas de confiança, reduzir cafeína e cuidar do sono. Reservar momentos para descansar também ajuda.

Pedir ajuda é um ato de cuidado, não de fraqueza. Converse sempre com seu médico ou um profissional de saúde mental se a ansiedade estiver pesando — há apoio disponível e tratamento.',
    '{F41}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Depressão: você não está sozinho',
    'A depressão é mais do que tristeza passageira. Ela pode trazer desânimo persistente, perda de interesse, cansaço, alterações no sono e no apetite por semanas seguidas.

É importante lembrar que se trata de uma condição de saúde, não de "falta de força de vontade". Manter vínculos, rotina, movimento e luz do dia pode ajudar, mas nem sempre é suficiente sozinho.

Buscar apoio faz toda a diferença e a recuperação é possível. Converse sempre com seu médico ou um profissional de saúde mental. Se houver pensamentos de se machucar, procure ajuda imediatamente ou ligue 188 (CVV).',
    '{F32}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Hipotireoidismo em palavras simples',
    'A tireoide é uma glândula no pescoço que ajuda a regular o ritmo do corpo. No hipotireoidismo, ela trabalha de forma mais lenta do que o necessário, o que pode causar cansaço, frio, pele seca ou ganho de peso.

Esses sinais são comuns a muitas situações, por isso só exames e avaliação ajudam a entender o que está acontecendo. Uma alimentação equilibrada e bons hábitos de sono apoiam o bem-estar geral.

Com acompanhamento, a condição costuma ser bem controlada. Converse sempre com seu médico para investigar seus sintomas e definir o cuidado mais adequado ao seu caso.',
    '{E03}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Rinite alérgica: aliviando os sintomas',
    'A rinite alérgica acontece quando o nariz reage a coisas como poeira, ácaros, pólen ou pelos de animais, causando espirros, coceira, nariz entupido ou escorrendo.

Medidas no ambiente ajudam bastante: manter a casa arejada, lavar roupas de cama com frequência, reduzir tapetes e cortinas que acumulam poeira e evitar fumaça de cigarro.

Conhecer os seus "gatilhos" é o primeiro passo para conviver melhor com a rinite. Converse sempre com seu médico para entender o que mais incomoda você e encontrar formas de aliviar os sintomas.',
    '{J30}', 2, 'Fiocruz', 'https://www.fiocruz.br'
  ),
  (
    'Enxaqueca: entendendo as crises',
    'A enxaqueca é uma dor de cabeça que costuma ser forte, muitas vezes de um lado, e pode vir acompanhada de náusea, sensibilidade à luz e aos sons. As crises atrapalham bastante o dia.

Observar possíveis desencadeantes — como sono irregular, jejum prolongado, estresse ou certos alimentos — pode ajudar a reduzir a frequência. Hidratação e rotina de sono também contribuem.

Anotar quando as crises acontecem é uma boa forma de se conhecer melhor. Converse sempre com seu médico se as dores forem frequentes ou intensas, para encontrar um plano de cuidado adequado a você.',
    '{G43}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Obesidade: cuidado e acolhimento',
    'A obesidade é uma condição de saúde complexa, ligada a vários fatores — genéticos, ambientais, emocionais e de estilo de vida. Ela merece cuidado e respeito, sem culpa ou julgamento.

Mudanças pequenas e sustentáveis tendem a funcionar melhor do que dietas radicais: pratos coloridos e equilibrados, mais movimento prazeroso no dia a dia, sono de qualidade e atenção ao bem-estar emocional.

Cada pessoa tem um ponto de partida diferente, e o acompanhamento faz diferença. Converse sempre com seu médico e, se possível, uma equipe multiprofissional para um plano feito para você.',
    '{E66}', 3, 'Ministério da Saúde', 'https://www.gov.br/saude'
  ),
  (
    'Cuidando do coração no dia a dia',
    'Cuidar do coração é cuidar da vida toda. Pressão, colesterol e açúcar no sangue equilibrados ajudam a manter as artérias saudáveis e reduzem o risco de problemas cardiovasculares ao longo do tempo.

Hábitos protetores caminham juntos: alimentação rica em alimentos naturais, atividade física regular, não fumar, moderar o álcool, dormir bem e cuidar do estresse. Pequenas escolhas diárias somam muito.

Acompanhar a saúde com exames de rotina ajuda a perceber sinais cedo. Converse sempre com seu médico para conhecer seus números e construir, juntos, um plano de prevenção que combine com a sua vida.',
    '{I10,E78,I25}', 4, 'Sociedade Brasileira de Cardiologia (SBC)', 'https://www.cardiol.br'
  )
;
