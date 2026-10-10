# Base de documentação imobiliária 2026 (referência)

Extraído de `Base_Documentacao_Imobiliaria_2026.xlsx` (corte em 06/10/2026), uma pesquisa parcial com fonte e status por regra.
É material de referência para abrir novos estados e cidades. **Nada aqui entra no motor sem conferência**: só regras com
status `CONFERIDO_FONTE_PRIMARIA` ou `TRANSCRITO_CONFERIDO` e, de preferência, um recibo real que bata ao centavo.

| Arquivo | Conteúdo |
|---|---|
| `Faixas_Emol.csv` | 375 faixas de escritura e registro em 10 UF (AC, AL, BA, CE, DF, ES, MG, RJ, RR, RS). Valores em R$, total sem ISS. |
| `UF_Emolumentos.csv` | Situação e lógica de cada uma das 27 UF, com a fonte oficial. |
| `Parametros.csv` | Regras fora da faixa fixa: excedentes de MG, RJ e CE e acréscimos de MT. |
| `Metodos.csv` | Operações do motor (faixa fixa, parcela financiada limitada, duas parcelas, ISS aditivo…). |
| `ITBI_Regras.csv` | ITBI de 157 cidades (capitais e as 5 maiores de cada UF), à vista e financiado. A maioria está `PENDENTE`. |
| `Municipios.csv` | As 157 cidades com população, ISS (base NFS-e) e status do ITBI. |
| `Beneficios.csv` | Benefícios condicionais: 50% do SFH (art. 290 da Lei 6.015), regras de SP, Curitiba, DF etc. |
| `Cobertura.csv` | Resumo do que está apurado por UF. |

## Conferência com o motor atual (MG)

- **Registro (Tabela 4, 5-e)**: as 23 faixas até R$ 3,2 mi batem com `src/lib/calc/registro.ts`.
  O excedente também: a faixa de R$ 3,2 a 3,7 mi do nosso código (8.133,92) é a faixa final + o 1º acréscimo (3.289,90),
  e cada R$ 500 mil seguinte soma 2.193,27, com TFJ fixa de 4.673,83.
- **Escritura (Tabela 1, 4-b)**: a planilha está certa, as faixas de escritura têm os mesmos valores das de registro.
  Conferido com um orçamento de cartório de notas (base R$ 472.489,30: lavratura 5.677,79; 25 folhas 347,63).
  No tabelionato o ISS incide sobre o líquido (bruto − Recompe de 7%), e no arquivamento sobre o total das folhas.
  O motor calcula isso em `src/lib/calc/notas.ts` (a antiga tabela fixa `notaryFees.ts` saiu: tinha 1 centavo a menos
  na faixa de R$ 420 a 560 mil e valores fora da regra acima de R$ 3,2 mi).
- **ITBI de Juiz de Fora**: 2% conferido. Na parte financiada pelo SFH, a planilha aponta que a Lei 11.914/2009 criou um teto
  indexado (R$ 41.971,00 na origem) e que o limite de R$ 107.603,17 usado no motor **não foi validado para 2026**.
- **Teto do SFH**: imóvel acima de R$ 2.250.000,00 não entra no SFH. O motor tira a regra do SFH no ITBI e os 50% do
  1º imóvel no registro (`TETO_SFH` em `src/lib/calc/financiamento.ts`). Esse teto é do valor do imóvel; o limite da parte
  financiada com 0,5% no ITBI de JF é outro número, municipal.
- **Belo Horizonte**: ITBI de 3% conferido em fonte primária. Cadastrada no motor sem regra de SFH (3% sobre o valor inteiro).
- **ISS dos cartórios**: Uberlândia, Contagem, Montes Claros e Betim têm 5% ativo na base NFS-e; JF e BH não têm registro
  ativo no recorte. O ISS é o do município do cartório, não o do imóvel.
  BH: 2% pela Lei 8.725/2003, art. 14, § 11 (incluído pela Lei 9.677/2008), conferido em 10/10/2026.

## Outros estados

Faixas transcritas, mas com ISS e componentes pendentes: AC, AL, BA (sem decomposição), CE, DF, ES, RJ, RR, RS.
ITBI conferido em: Belo Horizonte, Juiz de Fora, Brasília, Cuiabá, Curitiba, São Paulo, Fortaleza, Vitória, Goiânia,
Recife, Porto Velho, Caxias do Sul, Bayeux e São Cristóvão. SP ainda não tem tabela de cartório normalizada.
