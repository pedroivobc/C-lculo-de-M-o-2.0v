# Conversa no WhatsApp · simulação com o motor real

> Gerado por `npx tsx scripts/modelo-whatsapp.ts <pasta>` a partir do motor real (`server/agente/menu.ts`).

## Escritura de compra e venda simples, recebendo em mensagem escrita

**🧑 Corretor:** Oi

**🤖 Orçaí:**

```
Olá, Pedro! 👋 Eu faço o orçamento da documentação do imóvel.

O que você quer orçar?

1️⃣ Escritura
2️⃣ Financiamento
3️⃣ Atualizar valor de contrato

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Escritura*
Qual é o tipo?

1️⃣ Compra e venda
2️⃣ Doação
3️⃣ Renúncia de usufruto

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Compra e venda*
Qual é o tipo?

1️⃣ Compra e venda simples
2️⃣ Compra e venda com vínculo
3️⃣ Compra e venda com interveniência

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Compra e venda simples*

*Valor do imóvel*
Qual é o valor do imóvel?
_Ex.: 350000 ou 350 mil_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 350 mil

**🤖 Orçaí:**

```
*Como você quer receber o orçamento?*

1️⃣ Imagem (foto) · seu padrão
2️⃣ PDF
3️⃣ Mensagem escrita

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 3

**🤖 Orçaí:**

```
*ORÇAMENTO Nº 0143* · 06/10/2026
Escritura · Compra e venda simples
📍 Imóvel em Juiz de Fora (MG)
Base de cálculo: R$ 350.000,00

▪️ ITBI: *R$ 7.000,00*
▪️ Escritura: *R$ 5.397,88*
▪️ Registro: *R$ 5.245,68*
▪️ Certidões: *R$ 400,00*
▪️ Honorários: *R$ 700,00*

💰 *TOTAL ESTIMADO: R$ 18.743,56*

_Valores estimados com as tabelas vigentes de MG. Confirme com o cartório e a prefeitura antes do ato._
_Feito com Orçaí Imob_
```

**🤖 Orçaí:**

```
Quer fazer mais alguma coisa?

1️⃣ Fazer outro orçamento
2️⃣ Receber em outro formato
3️⃣ Ver os valores detalhados

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

## Financiamento Caixa SBPE, recebendo em imagem

**🧑 Corretor:** Bom dia

**🤖 Orçaí:**

```
Olá, Pedro! 👋 Eu faço o orçamento da documentação do imóvel.

O que você quer orçar?

1️⃣ Escritura
2️⃣ Financiamento
3️⃣ Atualizar valor de contrato

_Responda com o número da opção._
```

**🧑 Corretor:** 2

**🤖 Orçaí:**

```
*Financiamento*
Qual é o banco?

1️⃣ Caixa
2️⃣ Itaú
3️⃣ Bradesco
4️⃣ Santander

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Caixa*
Qual é a modalidade?

1️⃣ SBPE (financiamento comum)
2️⃣ Minha Casa Minha Vida
3️⃣ SFI
4️⃣ FGTS
5️⃣ Home equity (empréstimo com o imóvel de garantia)

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Caixa · SBPE*

*Valor do imóvel* (1 de 3)
Qual é o valor do imóvel?
_Ex.: 350000 ou 350 mil_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 400000

**🤖 Orçaí:**

```
*Valor financiado* (2 de 3)
Quanto vai ser financiado?
_Ex.: 350000 ou 350 mil_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 320 mil

**🤖 Orçaí:**

```
*Primeiro imóvel* (3 de 3)
É o primeiro imóvel do comprador?

1️⃣ Sim
2️⃣ Não

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Como você quer receber o orçamento?*

1️⃣ Imagem (foto) · seu padrão
2️⃣ PDF
3️⃣ Mensagem escrita

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
📎 orcamento-0143.jpg · Orçamento #0143 · Total R$ 19.259,87
```

**🤖 Orçaí:**

```
Quer fazer mais alguma coisa?

1️⃣ Fazer outro orçamento
2️⃣ Receber em outro formato
3️⃣ Ver os valores detalhados

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

## Quando a pessoa digita algo fora das opções

**🧑 Corretor:** oi

**🤖 Orçaí:**

```
Olá, Pedro! 👋 Eu faço o orçamento da documentação do imóvel.

O que você quer orçar?

1️⃣ Escritura
2️⃣ Financiamento
3️⃣ Atualizar valor de contrato

_Responda com o número da opção._
```

**🧑 Corretor:** quero orçar

**🤖 Orçaí:**

```
Não entendi 🙂 Responda só com o *número* de uma opção.

O que você quer orçar?

1️⃣ Escritura
2️⃣ Financiamento
3️⃣ Atualizar valor de contrato

_Responda com o número da opção._
```

**🧑 Corretor:** 0

**🤖 Orçaí:**

```
Não entendi 🙂 Responda só com o *número* de uma opção.

O que você quer orçar?

1️⃣ Escritura
2️⃣ Financiamento
3️⃣ Atualizar valor de contrato

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Escritura*
Qual é o tipo?

1️⃣ Compra e venda
2️⃣ Doação
3️⃣ Renúncia de usufruto

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 2

**🤖 Orçaí:**

```
*Doação*
Qual é o tipo?

1️⃣ Doação simples
2️⃣ Doação com usufruto

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orçaí:**

```
*Doação simples*

*Valor do imóvel* (1 de 2)
Qual é o valor do imóvel na doação?
_Ex.: 350000 ou 350 mil_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 350

**🤖 Orçaí:**

```
R$ 350 parece baixo. Digite o valor completo.

*Valor do imóvel* (1 de 2)
Qual é o valor do imóvel na doação?
_Ex.: 350000 ou 350 mil_

0️⃣ Voltar ao menu anterior
```
