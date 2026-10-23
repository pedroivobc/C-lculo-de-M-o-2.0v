# Capitais em teste piloto (out/2026)

São Paulo, Rio de Janeiro, Brasília, Curitiba, Porto Alegre e Balneário Camboriú. Entram escritura de compra e venda
(simples, interveniência e com vínculo), registro, ITBI e financiamento. Doação continua só em MG, porque o ITCD
desses estados ainda não está cadastrado.

O que o cálculo cobre em cada cartório: o ato principal pela faixa do valor (tabelas não progressivas), os fundos e
taxas que o estado soma e o ISS do município. Prenotação, certidões de matrícula, selos e arquivamento ficam de fora
(o orçamento avisa). Na 1ª aquisição pelo SFH entra a redução de 50% dos emolumentos do art. 290 da Lei 6.015/1973.

Código: `src/lib/calc/cartorios.ts` (emolumentos) e `src/lib/calc/municipios.ts` (ITBI e ISS).

## São Paulo (SP)

- **ITBI**: 3%. No SFH: 0,5% sobre o financiado até R$ 120.968,00, para imóvel de até R$ 725.808,00, e 3% no restante
  (valores de 2026). A isenção da 1ª aquisição até R$ 245.527,77 depende de requerimento e não é aplicada.
- **Notas**: tabela 2026 da capital (Lei estadual 11.331/2002), CNB-SP. O total já traz o ISS de 2%.
  - https://cnbsp.org.br/2025/12/22/cnb-sp-divulga-as-tabelas-de-custas-e-emolumentos-de-2026-em-formato-excel/
  - https://cartoriodenotas.com.br/wp-content/uploads/2026/01/tab2026.pdf (espelho da tabela, conferido)
- **Registro**: tabela 2026 da ARISP, item 1 (com valor declarado).
  - https://arisp.com.br/wp-content/uploads/2026/01/0.pdf
  - https://risantoamaro.com.br/wp-content/uploads/2026/02/Tabela-de-Emolumentos-2026-1.pdf
  - https://portaldori.com.br/2026/01/06/anoreg-sp-anoreg-sp-divulga-tabela-de-custas-e-emolumentos-dos-cartorios-do-estado-de-sao-paulo-para-2026/
- **ISS**: 2% (Lei municipal 15.406/2011).

## Rio de Janeiro (RJ)

- **ITBI**: 3% (Lei 6.250/2017), sem redução no financiamento.
- **Notas e registro**: Portaria CGJ 2.679/2025 (exercício 2026), Tabela 07 item 1 e Tabela 05.1 item 1. Emolumento,
  mais 2% (atos gratuitos/PMCMV), mais FETJ 20%, FUNPERJ 5%, FUNDPERJ 5% e FUNARPEN 6%, mais selo e ISS.
  Acima de R$ 561.711,99 soma um excedente a cada R$ 140.427,98. No SFH os fundos também são dispensados (nota 7ª).
  - https://www.tjrj.jus.br/documents/d/cgj/portaria-cgj-2679-2025-exerc-2026
  - https://www.tjrj.jus.br/documents/d/cgj/escrituras_publicas_com_valor_declarado_2026
- **ISS**: 5% (alíquota geral, Lei 691/1984).

## Brasília (DF)

- **ITBI**: 2% (Lei distrital 7.635/2024). O 1% da 1ª transmissão de imóvel novo depende de enquadramento e não entra.
- **Notas e registro**: tabela 2026 do TJDFT publicada pela ANOREG-DF, Tabela I item 1.1 e Tabela III item 1, com ISS de 5%.
  - https://anoregdf.org.br/wp-content/uploads/2025/12/TABELA-COMPLETA-DE-EMOLUMENTOS-2026.pdf
  - Conferido: registro de R$ 500 mil financiado (1º imóvel) bate com a tabela.

## Curitiba (PR)

- **ITBI**: 2,7% (LC 40/2001). Financiamento habitacional (LC 148/2025): alíquota pelo valor do imóvel, sobre a base
  inteira: 0% até R$ 176 mil, 0,5% até R$ 205 mil, 1,6% até R$ 220 mil, 2,7% acima.
- **Notas e registro**: Lei estadual 21.869/2023, VRC a R$ 0,277 (o reajuste do PL 1.016/2025 não foi votado).
  Tabela XI item IV e Tabela XIII item XIII-b. FUNDEP de 5% e ISS de 4%.
  - https://www.tjpr.jus.br/documents/14930420/33713065/Tabela%2Bde%2BEmolumentos%2B-%2BCorreta/49e07f25-92bf-34b2-6b6e-a38fd2ecc318
  - https://www.gazetadopovo.com.br/parana/cartorios-parana-defendem-reajuste-taxas/
- **Funrejus**: 0,2% do valor da transmissão, cobrado na escritura (ou no registro, quando não há escritura). **Teto
  aproximado** de R$ 7.950 (53 UPF/PR), a conferir.

## Porto Alegre (RS)

- **ITBI**: 3%. No SFH, 0,5% sobre o financiado até 68.000 UFM (R$ 410.794,80 com a UFM 2026 de R$ 6,0411) e 3% no
  restante (LC 197/1989, art. 16, redação da LC 607/2008).
  - http://lproweb.procempa.com.br/pmpa/prefpoa/smf/usu_doc/coletanea_da_legislacao_do_itbi_-_2018.pdf
  - https://www.cca.com.br/boletim/25552/itbi-porto-alegre-rs/
- **Notas e registro**: tabela 2026 do TJRS (reajuste de 5,86%), com processamento eletrônico de R$ 7,30 por ato.
  - https://www.tjrs.jus.br/static/2025/12/Tabela_de_Emolumentos_2026.pdf (site do TJRS instável; conferido no espelho)
  - https://www.canoasri.com.br/wp-content/uploads/2026/01/tabela-emolumentos-2026.pdf
  - https://www.registrodeimoveis.org.br/intranet/arquivos/upload/geral/888826_upload_de_arquivos_geral_20251226_174008_f6561d12-df91-4fd0-ad28-a8204b8b9d03.pdf
- **ISS**: **estimado em 5%** (teto da LC 116/2003). Não confirmado na lei municipal.

## Balneário Camboriú (SC)

- **ITBI**: 3%; no SFH, 1% sobre o financiado e 3% no restante (Lei municipal 4.994/2025). **Conferido em matérias de
  imprensa e no site da prefeitura**; o texto da lei não abriu.
  - https://www.bc.sc.gov.br/noticia/43065
  - https://leggicomunali.it/a/sc/b/balneario-camboriu/lei-ordinaria/2025/500/4994/lei-ordinaria-n-4994-2025-institui-e-integra-o-imposto-sobre-a-transmissao-de-bens-imoveis-itbi-ao-sistema-tributario-municipal-de-balneario-camboriu-sc-e-da-outras-providencias
  - https://www.gazetadopovo.com.br/santa-catarina/balneario-camboriu-corta-itbi-para-atrair-holdings/
- **Notas e registro**: LC estadual 755/2019 (alterada pela LC 846/2023), valores 2026 pelo INPC (Circular CGJ 643/2025).
  Registro: Tabela III item 2.2, conferido em tabela 2026 publicada por cartório de SC. **Notas: valores de 2020 × 1,37859**
  (mesmo fator do registro), a conferir com a tabela oficial. FRJ de 22,73%.
  - https://www.tjsc.jus.br/web/corregedoria-geral-da-justica/normas-e-orientacoes/emolumentos
  - https://www.tjsc.jus.br/documents/d/corregedoria-geral-da-justica/circularcgj643-2025-pdf
- **ISS**: **estimado em 5%** (teto da LC 116/2003). Não confirmado na lei municipal.

## A conferir antes de sair do piloto

1. ISS de cartório em Porto Alegre e Balneário Camboriú.
2. Texto da Lei 4.994/2025 de Balneário Camboriú.
3. Tabela de notas de SC 2026 (hoje derivada por fator).
4. Teto do Funrejus (PR).
5. Um recibo real de escritura e de registro em cada cidade.
