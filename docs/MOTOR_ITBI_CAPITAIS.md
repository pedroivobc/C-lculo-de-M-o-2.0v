# Motor de cálculo de ITBI — 5 principais capitais

Versão da pesquisa: 10/10/2026  
Capitais: São Paulo, Rio de Janeiro, Brasília, Fortaleza e Salvador, conforme estimativas populacionais do IBGE para 2025.

## Entradas do motor

| Campo | Tipo | Uso |
|---|---|---|
| municipio_ibge | texto | Define a regra local |
| data_fato_gerador | data | Seleciona a vigência |
| base_calculo | decimal | Valor sujeito às alíquotas |
| valor_transacao | decimal | Valor declarado no negócio |
| tipo_aquisicao | enum | avista, financiamento ou consorcio |
| sistema_financiamento | enum | SFH, SFI, CH, PAR, HIS ou OUTRO |
| valor_financiado | decimal | Parcela efetivamente financiada |
| primeira_aquisicao | booleano | Benefícios específicos |
| imovel_residencial | booleano | Benefícios específicos |
| primeira_transmissao_imovel_novo | booleano | Regra do Distrito Federal |
| atende_definicao_imovel_novo_df | booleano | Regra do Distrito Federal |
| imovel_popular_reconhecido | booleano | Regra de Salvador |
| pagamento_itbi_antecipado | booleano | Regra de Fortaleza |
| beneficio_mcmv_reconhecido | booleano | Isenções locais |
| valor_corretagem_com_nfse | decimal | Redução específica em Fortaleza |

A saída deve informar: base utilizada, imposto total, parcelas do cálculo, identificador da regra, necessidade de validação documental e observações.

## São Paulo/SP

### Regra

- À vista: ITBI = base × 3%.
- Financiamento SFH, PAR ou HIS, ou consórcio, para imóvel de até R$ 725.808,00 em 2026:
  - 0,5% sobre o menor valor entre o efetivamente financiado, R$ 120.968,00 e a base;
  - 3% sobre o restante da base.
- Imóvel acima de R$ 725.808,00, SFI, Carteira Hipotecária ou outro financiamento: 3% integral.
- Isenção relevante em 2026: primeira aquisição residencial por pessoa física ou aquisição no PMCMV, com valor total de até R$ 245.527,77, observados os requisitos municipais.

### Lógica

1. Se houver isenção validada, retornar zero.
2. Se a operação for elegível, definir faixa_reduzida = mínimo(valor_financiado, 120.968, base).
3. ITBI = faixa_reduzida × 0,5% + (base − faixa_reduzida) × 3%.
4. Nos demais casos, ITBI = base × 3%.

### Exemplos

**SP-1 — compra à vista**

Base de R$ 500.000,00.  
Cálculo: R$ 500.000,00 × 3%.  
**ITBI: R$ 15.000,00.**

**SP-2 — financiamento SFH**

Base de R$ 500.000,00 e financiamento de R$ 400.000,00.  
Parcela reduzida: R$ 120.968,00 × 0,5% = R$ 604,84.  
Restante: R$ 379.032,00 × 3% = R$ 11.370,96.  
**ITBI: R$ 11.975,80.**

**SP-3 — financiamento SFI**

Base de R$ 500.000,00 e financiamento de R$ 400.000,00. O SFI não recebe a faixa de 0,5%.  
Cálculo: R$ 500.000,00 × 3%.  
**ITBI: R$ 15.000,00.**

**SP-4 — primeira aquisição residencial isenta**

Valor/base de R$ 240.000,00, pessoa física, primeira aquisição e imóvel residencial.  
**ITBI: R$ 0,00**, sujeito à comprovação dos requisitos.

## Rio de Janeiro/RJ

### Regra

- À vista ou financiado: ITBI = base × 3%.
- O portal oficial consultado não estabelece faixa reduzida de ITBI somente por financiamento SFH.
- A autoridade municipal pode avaliar a base quando discordar do valor declarado.

### Exemplos

**RJ-1 — compra à vista**

Base de R$ 500.000,00 × 3%.  
**ITBI: R$ 15.000,00.**

**RJ-2 — compra financiada**

Base de R$ 500.000,00 e financiamento de R$ 400.000,00. A forma de pagamento não muda a alíquota.  
**ITBI: R$ 15.000,00.**

## Brasília/DF

### Regra

- Primeira transmissão onerosa de imóvel novo edificado: 1%.
- Demais casos: 2%.
- Imóvel novo é aquele cuja primeira transferência onerosa ocorre em até cinco anos contados do ano seguinte ao habite-se; também abrange imóvel em construção sob incorporação, na primeira transferência onerosa, com matrícula individualizada.
- A forma de pagamento não altera a alíquota.

### Exemplos

**DF-1 — imóvel novo, primeira transmissão**

Base de R$ 500.000,00 × 1%.  
**ITBI: R$ 5.000,00.**

**DF-2 — imóvel usado**

Base de R$ 500.000,00 × 2%.  
**ITBI: R$ 10.000,00.**

**DF-3 — imóvel novo financiado**

Base de R$ 500.000,00, financiamento de R$ 400.000,00 e primeira transmissão de imóvel novo.  
**ITBI: R$ 5.000,00.**

## Fortaleza/CE

### Regra

- Regra geral: 4%.
- Pagamento do ITBI antes da lavratura do instrumento: 2% sobre a parcela normalmente sujeita a 4%.
- Financiamento SFH:
  - 0,5% sobre o efetivamente financiado, limitado a R$ 390.672,24 em 2026;
  - sobre o restante da base: 2% com pagamento antecipado do ITBI ou 4% sem antecipação.
- A base pode ser reduzida pelo valor da corretagem comprovada por NFS-e emitida no sistema municipal.
- A SEFIN informa isenção para PMCMV. O motor deve exigir benefício validado.

### Lógica

1. base_ajustada = máximo(zero, base − corretagem válida).
2. Se PMCMV validado, retornar zero.
3. aliquota_restante = 2% se ITBI antecipado; senão 4%.
4. No SFH, faixa_reduzida = mínimo(valor_financiado, 390.672,24, base_ajustada).
5. ITBI = faixa_reduzida × 0,5% + (base_ajustada − faixa_reduzida) × aliquota_restante.
6. Fora do SFH, ITBI = base_ajustada × aliquota_restante.

### Exemplos

**FOR-1 — compra à vista com ITBI antecipado**

Base de R$ 500.000,00 × 2%.  
**ITBI: R$ 10.000,00.**

**FOR-2 — compra à vista sem antecipação**

Base de R$ 500.000,00 × 4%.  
**ITBI: R$ 20.000,00.**

**FOR-3 — financiamento SFH com ITBI antecipado**

Base de R$ 500.000,00 e financiamento de R$ 400.000,00.  
Parcela reduzida: R$ 390.672,24 × 0,5% = R$ 1.953,36.  
Restante: R$ 109.327,76 × 2% = R$ 2.186,56.  
**ITBI: R$ 4.139,92.**

**FOR-4 — financiamento SFH sem antecipação**

Parcela reduzida: R$ 390.672,24 × 0,5% = R$ 1.953,36.  
Restante: R$ 109.327,76 × 4% = R$ 4.373,11.  
**ITBI: R$ 6.326,47.**

**FOR-5 — redução da base por corretagem**

Base inicial de R$ 500.000,00 e corretagem de R$ 25.000,00 comprovada por NFS-e municipal. Base ajustada de R$ 475.000,00, com ITBI antecipado.  
Cálculo: R$ 475.000,00 × 2%.  
**ITBI: R$ 9.500,00.**

## Salvador/BA

### Regra

- Regra geral do ITIV: 3%.
- Imóvel popular reconhecido conforme regulamento: 1%.
- As fontes oficiais consultadas não apresentam alíquota diferente apenas por existir financiamento.
- O sistema não deve presumir imóvel popular com base somente no preço.

### Exemplos

**SSA-1 — compra à vista, regra geral**

Base de R$ 500.000,00 × 3%.  
**ITIV: R$ 15.000,00.**

**SSA-2 — compra financiada, regra geral**

Base de R$ 500.000,00 e financiamento de R$ 400.000,00.  
**ITIV: R$ 15.000,00.**

**SSA-3 — imóvel popular reconhecido**

Base de R$ 200.000,00 × 1%.  
**ITIV: R$ 2.000,00**, sujeito ao enquadramento municipal.

## Casos de teste

| ID | Cidade | Base | Condição | Resultado |
|---|---|---:|---|---:|
| SP_AVISTA_500K | São Paulo | R$ 500.000,00 | À vista | R$ 15.000,00 |
| SP_SFH_500K | São Paulo | R$ 500.000,00 | SFH, financiado R$ 400 mil | R$ 11.975,80 |
| SP_SFI_500K | São Paulo | R$ 500.000,00 | SFI, financiado R$ 400 mil | R$ 15.000,00 |
| SP_ISENTO_240K | São Paulo | R$ 240.000,00 | 1ª aquisição residencial PF | R$ 0,00 |
| RJ_AVISTA_500K | Rio de Janeiro | R$ 500.000,00 | À vista | R$ 15.000,00 |
| RJ_FIN_500K | Rio de Janeiro | R$ 500.000,00 | Financiado R$ 400 mil | R$ 15.000,00 |
| DF_NOVO_500K | Brasília | R$ 500.000,00 | 1ª transmissão de imóvel novo | R$ 5.000,00 |
| DF_USADO_500K | Brasília | R$ 500.000,00 | Demais casos | R$ 10.000,00 |
| FOR_AV_ANT_500K | Fortaleza | R$ 500.000,00 | À vista e ITBI antecipado | R$ 10.000,00 |
| FOR_AV_NANT_500K | Fortaleza | R$ 500.000,00 | À vista sem antecipação | R$ 20.000,00 |
| FOR_SFH_ANT_500K | Fortaleza | R$ 500.000,00 | SFH R$ 400 mil e antecipado | R$ 4.139,92 |
| FOR_SFH_NANT_500K | Fortaleza | R$ 500.000,00 | SFH R$ 400 mil sem antecipação | R$ 6.326,47 |
| SSA_GERAL_500K | Salvador | R$ 500.000,00 | Regra geral | R$ 15.000,00 |
| SSA_POP_200K | Salvador | R$ 200.000,00 | Imóvel popular reconhecido | R$ 2.000,00 |

## Regras técnicas

1. Usar decimal para valores monetários e arredondar para duas casas no fim de cada parcela exibida e do total.
2. Não inferir SFH pelo banco. Ler o sistema no contrato.
3. Não confundir desconto de emolumentos de primeira aquisição com benefício de ITBI.
4. Benefícios sujeitos a reconhecimento devem gerar exige_validacao_documental = true.
5. Versionar cada regra com vigência, fonte e data de conferência.
6. Em São Paulo, testar o teto do imóvel antes de aplicar a faixa reduzida.
7. Em Fortaleza, perguntar separadamente se o ITBI será pago antes do instrumento.
8. Em Salvador, não aplicar 1% somente porque o imóvel tem preço baixo.
9. Guardar separadamente valor_transacao, valor_avaliacao_municipal, base_calculo_utilizada, origem_base_calculo e base_impugnada.

## Fontes oficiais

- IBGE: estimativas populacionais de 2025.
- São Paulo: Prefeitura, ITBI — Cálculo do Imposto, atualização de 13/01/2026.
- São Paulo: Prefeitura, ITBI — Imunidades, Isenções e Incentivos Fiscais, atualização de 13/01/2026.
- Rio de Janeiro: Secretaria Municipal de Fazenda, Cálculo do ITBI.
- Distrito Federal: Lei nº 7.635/2024 e Decreto nº 46.695/2024, vigentes desde 01/01/2025.
- Fortaleza: SEFIN, página oficial de alíquotas e perguntas frequentes, valores de 2026.
- Fortaleza: Código Tributário Municipal, LC nº 159/2013, atualizado até a LC nº 452/2025.
- Salvador: SEFAZ, perguntas e respostas sobre base de cálculo, avaliação e alíquotas do ITIV.

## Base de cálculo e divergência municipal

O Tema Repetitivo 1.113 do STJ estabelece que o valor declarado da transação presume-se compatível com o mercado e somente pode ser afastado mediante processo administrativo próprio. Em 2026, a Lei Complementar federal nº 227 detalhou no art. 38 do CTN os critérios de estimativa do valor venal. Como os portais locais ainda descrevem seus procedimentos de avaliação, o sistema deve calcular a guia com a base efetivamente adotada e sinalizar possível divergência para revisão.

