# Conversa no WhatsApp · simulação com o motor real

> Gerado por `npx tsx scripts/modelo-whatsapp.ts <pasta>` a partir do motor real (`server/agente/menu.ts`). Com `WHATSAPP_BOTOES=sim`, as opções numeradas abaixo vão como botões (até 3) ou lista (até 10); o texto continua aceito.

## Escritura de compra e venda simples, com endereço, recebendo em mensagem escrita

**🧑 Corretor:** Oi

**🤖 Orça.ai:**

```
Olá, Pedro! 👋 Qual tipo de cálculo iremos fazer hoje?

1️⃣ Compra e venda
2️⃣ Financiamento
3️⃣ Doação
4️⃣ Correção contratual

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orça.ai:**

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

**🤖 Orça.ai:**

```
*Compra e venda simples*

*Valor do imóvel*
Qual é o valor do imóvel?
_Pode digitar só os números: 350000 vira R$ 350.000,00_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 350 mil

**🤖 Orça.ai:**

```
✅ Valor do imóvel: *R$ 350.000,00*

*Endereço do imóvel*
Quer colocar o endereço do imóvel no orçamento?

1️⃣ Sim
2️⃣ Não

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orça.ai:**

```
*Endereço do imóvel*
Digite o endereço como quer que apareça no orçamento.
_Ex.: Rua Halfeld, 100, apto 201 · Centro_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** Rua Halfeld, 100, apto 201 · Centro

**🤖 Orça.ai:**

```
✅ Endereço: *Rua Halfeld, 100, apto 201 · Centro*

Certidões: *R$ 400,00*
Honorários: *R$ 700,00*
_Para mudar só neste orçamento, escreva_ *honorarios 900* _ou_ *certidoes 350*

*Como você quer receber o orçamento?*

1️⃣ Imagem (foto) · seu padrão
2️⃣ PDF
3️⃣ Mensagem escrita

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 3

**🤖 Orça.ai:**

```
*ORÇAMENTO Nº 0143* · 09/10/2026
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
_Feito com Orça.ai Imob_
```

**🤖 Orça.ai:**

```
Quer fazer mais alguma coisa?

1️⃣ Fazer outro orçamento
2️⃣ Receber em outro formato
3️⃣ Ver os valores detalhados
4️⃣ Falar com um atendente

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

## Financiamento Caixa SBPE com cota de 80%, sem endereço, trocando os honorários e recebendo em imagem

**🧑 Corretor:** Bom dia

**🤖 Orça.ai:**

```
Olá, Pedro! 👋 Qual tipo de cálculo iremos fazer hoje?

1️⃣ Compra e venda
2️⃣ Financiamento
3️⃣ Doação
4️⃣ Correção contratual

_Responda com o número da opção._
```

**🧑 Corretor:** 2

**🤖 Orça.ai:**

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

**🤖 Orça.ai:**

```
*Caixa*
Qual é a modalidade?

1️⃣ SBPE · financiamento comum
2️⃣ Minha Casa Minha Vida
3️⃣ SFI
4️⃣ FGTS
5️⃣ Home equity · empréstimo com o imóvel de garantia

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orça.ai:**

```
*Caixa · SBPE*

*Valor do imóvel* (1 de 3)
Qual é o valor do imóvel?
_Pode digitar só os números: 350000 vira R$ 350.000,00_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 400000

**🤖 Orça.ai:**

```
✅ Valor do imóvel: *R$ 400.000,00*

*Valor financiado* (2 de 3)
Quanto vai ser financiado?
Digite o valor ou a cota em %.
_Ex.: 320000 ou 80% (= R$ 320.000,00)_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 80%

**🤖 Orça.ai:**

```
✅ Valor financiado: *R$ 320.000,00* (80% de R$ 400.000,00)

*Primeiro imóvel* (3 de 3)
É o primeiro imóvel do comprador?

1️⃣ Sim
2️⃣ Não

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orça.ai:**

```
✅ Primeiro imóvel: *Sim*

*Endereço do imóvel*
Quer colocar o endereço do imóvel no orçamento?

1️⃣ Sim
2️⃣ Não

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 2

**🤖 Orça.ai:**

```
Certidões: *R$ 260,07*
Honorários: *R$ 700,00*
_Para mudar só neste orçamento, escreva_ *honorarios 900* _ou_ *certidoes 350*

*Como você quer receber o orçamento?*

1️⃣ Imagem (foto) · seu padrão
2️⃣ PDF
3️⃣ Mensagem escrita

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** honorarios 900

**🤖 Orça.ai:**

```
✅ Honorários deste orçamento: *R$ 900,00*

Certidões: *R$ 260,07*
Honorários: *R$ 900,00*
_Para mudar só neste orçamento, escreva_ *honorarios 900* _ou_ *certidoes 350*

*Como você quer receber o orçamento?*

1️⃣ Imagem (foto) · seu padrão
2️⃣ PDF
3️⃣ Mensagem escrita

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orça.ai:**

```
📎 orcamento-0143.jpg · Orçamento #0143 · Total R$ 19.498,20
```

**🤖 Orça.ai:**

```
Quer fazer mais alguma coisa?

1️⃣ Fazer outro orçamento
2️⃣ Receber em outro formato
3️⃣ Ver os valores detalhados
4️⃣ Falar com um atendente

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

## Doação simples recebendo em PDF e depois pedindo um atendente

**🧑 Corretor:** Oi

**🤖 Orça.ai:**

```
Olá, Pedro! 👋 Qual tipo de cálculo iremos fazer hoje?

1️⃣ Compra e venda
2️⃣ Financiamento
3️⃣ Doação
4️⃣ Correção contratual

_Responda com o número da opção._
```

**🧑 Corretor:** 3

**🤖 Orça.ai:**

```
*Doação*
Qual é o tipo?

1️⃣ Doação simples
2️⃣ Doação com usufruto
3️⃣ Renúncia de usufruto

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orça.ai:**

```
*Doação simples*

*Valor do imóvel* (1 de 2)
Qual é o valor do imóvel na doação?
_Pode digitar só os números: 350000 vira R$ 350.000,00_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 300 mil

**🤖 Orça.ai:**

```
✅ Valor do imóvel: *R$ 300.000,00*

*Avaliação da Fazenda* (2 de 2)
Qual é a avaliação da Fazenda (ITCD)?
Se ainda não tem, responda *não sei*.
_Pode digitar só os números: 350000 vira R$ 350.000,00_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** não sei

**🤖 Orça.ai:**

```
✅ Avaliação da Fazenda: *ainda não tem*

*Endereço do imóvel*
Quer colocar o endereço do imóvel no orçamento?

1️⃣ Sim
2️⃣ Não

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 2

**🤖 Orça.ai:**

```
Certidões: *R$ 400,00*
Honorários: *R$ 700,00*
_Para mudar só neste orçamento, escreva_ *honorarios 900* _ou_ *certidoes 350*

*Como você quer receber o orçamento?*

1️⃣ Imagem (foto) · seu padrão
2️⃣ PDF
3️⃣ Mensagem escrita

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 2

**🤖 Orça.ai:**

```
📎 orcamento-0143.pdf · Orçamento #0143 · Total R$ 19.243,56
```

**🤖 Orça.ai:**

```
Quer fazer mais alguma coisa?

1️⃣ Fazer outro orçamento
2️⃣ Receber em outro formato
3️⃣ Ver os valores detalhados
4️⃣ Falar com um atendente

0️⃣ Voltar ao menu anterior

_Responda com o número da opção._
```

**🧑 Corretor:** 4

_(a conversa é aberta no Chatwoot com a etiqueta "atendente"; o robô fica quieto até o corretor escrever menu)_

**🤖 Orça.ai:**

```
Certo! Vou chamar alguém da nossa equipe para falar com você por aqui. 🙋

_Quando quiser voltar aos orçamentos automáticos, escreva_ *menu*.
```

**🧑 Corretor:** obrigado

_(robô em silêncio: a pessoa da equipe responde pelo Chatwoot)_

**🧑 Corretor:** menu

**🤖 Orça.ai:**

```
Olá, Pedro! 👋 Qual tipo de cálculo iremos fazer hoje?

1️⃣ Compra e venda
2️⃣ Financiamento
3️⃣ Doação
4️⃣ Correção contratual

_Responda com o número da opção._
```

## Quando a pessoa digita algo fora das opções

**🧑 Corretor:** oi

**🤖 Orça.ai:**

```
Olá, Pedro! 👋 Qual tipo de cálculo iremos fazer hoje?

1️⃣ Compra e venda
2️⃣ Financiamento
3️⃣ Doação
4️⃣ Correção contratual

_Responda com o número da opção._
```

**🧑 Corretor:** quero orçar

**🤖 Orça.ai:**

```
Não entendi 🙂 Responda só com o *número* de uma opção.

Qual tipo de cálculo iremos fazer hoje?

1️⃣ Compra e venda
2️⃣ Financiamento
3️⃣ Doação
4️⃣ Correção contratual

_Responda com o número da opção._
```

**🧑 Corretor:** 0

**🤖 Orça.ai:**

```
Não entendi 🙂 Responda só com o *número* de uma opção.

Qual tipo de cálculo iremos fazer hoje?

1️⃣ Compra e venda
2️⃣ Financiamento
3️⃣ Doação
4️⃣ Correção contratual

_Responda com o número da opção._
```

**🧑 Corretor:** 1

**🤖 Orça.ai:**

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

**🤖 Orça.ai:**

```
*Compra e venda simples*

*Valor do imóvel*
Qual é o valor do imóvel?
_Pode digitar só os números: 350000 vira R$ 350.000,00_

0️⃣ Voltar ao menu anterior
```

**🧑 Corretor:** 350

**🤖 Orça.ai:**

```
R$ 350,00 parece baixo. Digite o valor completo, ex.: 350000 para R$ 350.000,00.

*Valor do imóvel*
Qual é o valor do imóvel?
_Pode digitar só os números: 350000 vira R$ 350.000,00_

0️⃣ Voltar ao menu anterior
```
