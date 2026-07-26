# WHO Child Growth Standards — LMS seed (`who_lms.json`)

## Fonte oficial

- **Pacote:** `anthro` — *Computation of the WHO Child Growth Standards*
- **Repositório:** https://github.com/WorldHealthOrganization/anthro
- **Detentor dos direitos / publicador:** **World Health Organization (OMS)**
- **Autores:** Dirk Schumacher, Elaine Borghi, Jonathan Polonsky, Giovanna Gatica Dominguez (copyright: WHO)
- **Licença:** **GPL-3**
- **Rastreabilidade à OMS:** SIM. Este é o pacote **oficial da própria OMS** (organização `WorldHealthOrganization` no GitHub). Os arquivos de dados são as tabelas LMS originais dos *WHO Child Growth Standards (2006)*.

### Arquivos brutos usados (pasta `data-raw/growthstandards/` do pacote)

| Indicador (saída) | Arquivo de origem | Significado |
|---|---|---|
| `wfa`  | `weianthro.txt` | weight-for-age (peso por idade) |
| `lhfa` | `lenanthro.txt` | length/height-for-age (comprimento/altura por idade) |
| `bfa`  | `bmianthro.txt` | BMI-for-age (IMC por idade) |
| `hcfa` | `hcanthro.txt`  | head-circumference-for-age (perímetro cefálico por idade) |

URLs raw (branch `master`):
- https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards/weianthro.txt
- https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards/lenanthro.txt
- https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards/bmianthro.txt
- https://raw.githubusercontent.com/WorldHealthOrganization/anthro/master/data-raw/growthstandards/hcanthro.txt

Formato de cada arquivo: TSV com colunas `sex` (1 = male, 2 = female), `age` (em **dias**, 0–1826), `l`, `m`, `s`
(`lenanthro`/`bmianthro` têm coluna extra `loh` = Length/Height; não afeta L/M/S).

## Conversão de idade (dias → meses inteiros)

Os arquivos são indexados por **dia** (0 a 1826 dias = 0 a 60 meses). Para cada mês inteiro `m` (0..60)
selecionamos a linha do **dia âncora** definido pela própria OMS no pacote `anthro`:

```
dia_âncora(m) = round_up(m * 30.4375)
```

onde `30.4375` é a constante `ANTHRO_DAYS_OF_MONTH` definida em
`R/utils.R` do pacote, e `round_up` arredonda para cima quando a fração ≥ 0,5.
Exemplos: mês 0 → dia 0; mês 1 → dia 30; mês 12 → dia 365; mês 24 → dia 731; mês 60 → dia 1826.

Os valores L/M/S **não foram arredondados**; são copiados exatamente como na fonte.

## Verificação independente

Os valores do dia 0 foram conferidos contra a planilha oficial **expandida** da OMS
(`wfa-boys-zscore-expanded-tables.xlsx`, baixada de `cdn.who.int`):
L=0.3487 / M=3.3464 / S=0.14602 — **idênticos** à nossa linha `wfa male age_months=0`.
Demais medianas conferem com valores publicados (ex.: peso mediano do menino aos 12 m ≈ 9,646 kg;
comprimento mediano da menina aos 24 m ≈ 85,73 cm; perímetro cefálico mediano do menino ao nascer ≈ 34,46 cm).

## Cobertura

| Indicador | male (0–60) | female (0–60) | linhas |
|---|---|---|---|
| `wfa`  | ✅ 61 | ✅ 61 | 122 |
| `lhfa` | ✅ 61 | ✅ 61 | 122 |
| `bfa`  | ✅ 61 | ✅ 61 | 122 |
| `hcfa` | ✅ 61 | ✅ 61 | 122 |
| **Total** | | | **488** |

Cada par (indicador, sexo) cobre os 61 meses inteiros de 0 a 60, sem lacunas.

## Pendências / não incluído

- **`wfl` / `wfh`** (weight-for-length / weight-for-height): NÃO incluídos neste seed.
  Estão disponíveis na mesma fonte (`wflanthro.txt` e `wfhanthro.txt`), porém são indexados por
  **comprimento/altura (cm)**, não por idade em meses — exigem um esquema de seed diferente
  (chave por cm, não por `age_months`). Ficam como trabalho futuro se o app precisar de z-score peso/estatura.
- Indicadores de prega cutânea (`ssanthro` = subscapular, `tsanthro` = triceps) e
  circunferência do braço (`acanthro`) existem na fonte mas estão fora do escopo solicitado.

## Como reproduzir

1. Baixar os 4 arquivos `.txt` das URLs raw acima.
2. Para cada mês 0..60, calcular `dia = round_up(mês * 30.4375)`.
3. Selecionar a linha `(sex, dia)` e emitir `{indicator, sex (male/female), age_months, l, m, s}`.
