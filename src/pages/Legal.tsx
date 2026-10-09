import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lockup } from '@/components/marca/Logo';
import { AGENTE_WHATSAPP, EMPRESA, MARCA, PLANOS, preco } from '@/lib/config';

const ATUALIZADO_EM = '6 de outubro de 2026';

function Contato() {
  return (
    <>
      {EMPRESA.emailPrivacidade && <>pelo e-mail <a href={`mailto:${EMPRESA.emailPrivacidade}`} className="font-bold text-acao">{EMPRESA.emailPrivacidade}</a></>}
      {EMPRESA.emailPrivacidade && AGENTE_WHATSAPP && ' ou '}
      {AGENTE_WHATSAPP && <>pelo WhatsApp <a href={`https://wa.me/${AGENTE_WHATSAPP}`} className="font-bold text-acao">+{AGENTE_WHATSAPP}</a></>}
      {!EMPRESA.emailPrivacidade && !AGENTE_WHATSAPP && 'pelos canais de suporte informados na sua conta'}
    </>
  );
}

const operador = `${EMPRESA.nome}${EMPRESA.cnpj ? `, CNPJ ${EMPRESA.cnpj}` : ''}, com sede em ${EMPRESA.cidade}`;

function Pagina({ titulo, resumo, children }: { titulo: string; resumo: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-texto">
      <header className="border-b border-linha bg-white">
        <nav aria-label="Principal" className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-3.5">
          <Link to="/" className="no-underline"><Lockup tamanho={22} /></Link>
          <div className="ml-auto flex gap-4 whitespace-nowrap text-[14px] font-semibold sm:gap-5 sm:text-[15px]">
            <Link to="/termos" className="text-texto no-underline hover:text-tinta">Termos de uso</Link>
            <Link to="/privacidade" className="text-texto no-underline hover:text-tinta">Privacidade</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-[760px] px-6 pb-20 pt-12">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-suave">{MARCA} · atualizado em {ATUALIZADO_EM}</p>
        <h1 className="display mt-3 text-[40px] font-black leading-[1.05] text-tinta">{titulo}</h1>
        <div className="mt-6 rounded-[20px] bg-nevoa p-6 text-[17px] leading-7 text-tinta">{resumo}</div>
        <div className="legal mt-10 flex flex-col gap-9 text-[16px] leading-7">{children}</div>
      </main>
      <footer className="border-t border-linha">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-x-8 gap-y-3 p-6 text-[13px] text-suave">
          <span>{MARCA} · um produto {EMPRESA.nome}</span>
          <span className="flex gap-5"><Link to="/termos" className="text-suave">Termos de uso</Link><Link to="/privacidade" className="text-suave">Política de privacidade</Link></span>
        </div>
      </footer>
    </div>
  );
}

function Secao({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`} className="flex flex-col gap-3">
      <h2 id={`s${n}`} className="text-[22px] font-extrabold leading-tight text-tinta">{n}. {titulo}</h2>
      {children}
    </section>
  );
}

const Lista = ({ itens }: { itens: ReactNode[] }) => (
  <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-suave">{itens.map((i, k) => <li key={k}>{i}</li>)}</ul>
);

/** Tabela dos dados tratados: o que é, para quê e por quanto tempo. */
const DADOS: [string, string, string, string][] = [
  ['Cadastro', 'Nome, e-mail, CPF, WhatsApp e senha. A senha fica cifrada pelo provedor de autenticação; nós não temos acesso a ela.', 'Criar e proteger a sua conta, reconhecer o seu número no agente do WhatsApp, impedir contas repetidas (um CPF por conta, também para o teste grátis e o cupom de indicação) e emitir a nota fiscal da assinatura.', 'Enquanto a conta existir e, para a nota fiscal, pelo prazo da legislação fiscal.'],
  ['Configuração do orçamento', 'Cidade, alíquota do ITBI, certidões e honorários padrão, formato (PDF ou imagem) e, no plano Pró, logo, cor e cabeçalho. No Pró, o seu nome, WhatsApp e e-mail aparecem no orçamento para o cliente falar com você.', 'Montar os orçamentos do seu jeito.', 'Enquanto a conta existir.'],
  ['Orçamentos', 'Os valores que você informa (valor do imóvel, valor financiado, cidade, folhas), o resultado e o arquivo gerado. O endereço do imóvel só entra se você escolher colocá-lo no orçamento.', 'Mostrar o orçamento, guardar o seu histórico e permitir baixar de novo.', 'Até você apagar o orçamento ou encerrar a conta.'],
  ['Conversas com o agente', 'O texto das mensagens trocadas com o agente. Fotos e arquivos não são abertos, lidos nem guardados: registramos só que a mensagem tinha um anexo.', 'Responder com o contexto da conversa e investigar erros.', '30 dias.'],
  ['Verificação do WhatsApp', 'Um código de uso único, guardado só como resumo criptográfico (hash).', 'Confirmar que o número é seu.', 'Até a verificação ou a expiração do código.'],
  ['Pagamento', 'O número do cartão vai direto para a Stripe, nossa processadora de pagamentos. Guardamos só o código (token) que o gateway devolve, a bandeira, os 4 últimos dígitos e a validade.', 'Cobrar a assinatura.', 'Enquanto a assinatura existir e pelo prazo exigido pela lei fiscal.'],
  ['Indicação', 'Quem indicou você (pelo cupom) e, para quem indica, o primeiro nome de quem usou o cupom e se já assinou.', 'Dar os dias extras de teste e o mês grátis de quem indicou.', 'Enquanto as contas existirem.'],
  ['Pedido de nova cidade', 'A cidade e, se você quiser, um WhatsApp.', 'Avisar quando a cidade abrir.', 'Até a cidade abrir ou você pedir a exclusão.'],
];

export function Privacidade() {
  return (
    <Pagina
      titulo="Política de privacidade"
      resumo={<>
        <strong>Em resumo:</strong> o {MARCA} não pede nem guarda documentos ou dados pessoais dos seus clientes. Para orçar,
        bastam os valores do negócio: valor do imóvel, valor financiado e cidade. Guardamos os dados da sua conta, os orçamentos
        que você faz e, por 30 dias, as conversas com o agente. Não vendemos dados e não usamos rastreadores de publicidade.
      </>}
    >
      <Secao n={1} titulo="Quem cuida dos seus dados">
        <p>O {MARCA} é operado por {operador}, que é a controladora dos dados tratados no serviço, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD).</p>
        <p>Para falar sobre privacidade ou exercer os seus direitos, fale conosco <Contato />.</p>
      </Secao>

      <Secao n={2} titulo="Dados dos seus clientes">
        <p>O serviço foi feito para funcionar <strong>sem dados pessoais de terceiros</strong>. Não pedimos nome, CPF, RG, estado civil, matrícula, contrato nem qualquer documento do comprador, do vendedor ou do donatário.</p>
        <p>Os orçamentos usam só valores. O endereço do imóvel é opcional: o sistema pergunta antes se você quer colocá-lo no orçamento. Pedimos que você não escreva ali, nem nas mensagens ao agente, o nome, o CPF ou o contato dos seus clientes. Se escrever, esse texto fica guardado como descrito na seção 3.</p>
      </Secao>

      <Secao n={3} titulo="Que dados tratamos, para quê e por quanto tempo">
        <div className="flex flex-col gap-4">
          {DADOS.map(([nome, oque, praque, tempo]) => (
            <div key={nome} className="rounded-2xl border border-linha p-5">
              <h3 className="text-[17px] font-extrabold text-tinta">{nome}</h3>
              <p className="mt-1">{oque}</p>
              <p className="mt-2 text-[15px] text-suave"><strong className="text-texto">Para quê:</strong> {praque} <strong className="text-texto">Por quanto tempo:</strong> {tempo}</p>
            </div>
          ))}
        </div>
        <p>A base legal é a execução do contrato de assinatura (art. 7º, V, da LGPD) e, no caso de registros e dados de cobrança, o cumprimento de obrigação legal (art. 7º, II). Pedidos de nova cidade feitos por quem ainda não é assinante se apoiam no consentimento (art. 7º, I), que pode ser retirado a qualquer momento.</p>
      </Secao>

      <Secao n={4} titulo="Com quem compartilhamos">
        <p>Não vendemos nem alugamos dados. Usamos fornecedores que tratam dados em nosso nome, só para o serviço funcionar:</p>
        <Lista itens={[
          <><strong>Supabase:</strong> banco de dados, login e armazenamento dos arquivos (orçamentos e logos).</>,
          <><strong>Google (Gemini):</strong> interpreta as mensagens enviadas ao agente para identificar os valores do cálculo. Recebe só o texto das mensagens recentes.</>,
          <><strong>WhatsApp e o provedor de integração (Evolution API):</strong> recebem e entregam as mensagens do agente.</>,
          <><strong>Gateway de pagamento:</strong> processa a cobrança da assinatura, quando a cobrança online estiver ativa.</>,
          <><strong>Hospedagem do servidor:</strong> onde o site e o agente rodam.</>,
        ]} />
        <p>Alguns desses fornecedores podem tratar dados fora do Brasil. Nesses casos, a transferência segue o art. 33 da LGPD, com garantias contratuais de proteção. Também podemos compartilhar dados quando a lei ou uma ordem judicial exigir.</p>
      </Secao>

      <Secao n={5} titulo="Cookies e armazenamento no navegador">
        <p>Usamos só o armazenamento do navegador necessário para manter você conectado. Não usamos cookies de publicidade, pixels nem ferramentas de rastreamento de terceiros.</p>
      </Secao>

      <Secao n={6} titulo="Segurança">
        <Lista itens={[
          'Cada conta só enxerga os próprios orçamentos e conversas: a regra é aplicada no próprio banco de dados.',
          'Orçamentos e logos ficam em armazenamento privado. O envio pelo WhatsApp usa links que expiram.',
          'O agente só atende o número confirmado por código no cadastro.',
          'Números de cartão nunca passam pelo nosso servidor.',
        ]} />
        <p>Nenhum sistema é totalmente imune a falhas. Se houver um incidente que possa trazer risco a você, avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD), como manda a lei.</p>
      </Secao>

      <Secao n={7} titulo="Quando a conta é encerrada">
        <p>Ao encerrar a conta, apagamos os seus dados em até 30 dias. Guardamos apenas o que a lei obriga, pelo prazo que ela determina: registros de acesso (6 meses, Marco Civil da Internet) e dados de cobrança (prazo da legislação fiscal).</p>
      </Secao>

      <Secao n={8} titulo="Seus direitos">
        <p>Você pode, a qualquer momento e sem custo, pedir:</p>
        <Lista itens={[
          'a confirmação de que tratamos seus dados e o acesso a eles;',
          'a correção de dados incompletos ou desatualizados;',
          'a cópia dos seus dados em formato aberto (portabilidade), incluindo o histórico de orçamentos;',
          'a exclusão dos dados e o encerramento da conta;',
          'a informação de com quem compartilhamos os dados;',
          'a revisão de decisões tomadas só por meios automatizados e a retirada do consentimento, quando ele for a base do tratamento.',
        ]} />
        <p>Para isso, fale conosco <Contato />. Respondemos em até 15 dias. Você também pode reclamar à ANPD (gov.br/anpd).</p>
      </Secao>

      <Secao n={9} titulo="Mudanças nesta política">
        <p>Se esta política mudar de forma relevante, avisaremos no site ou pelo WhatsApp antes de a mudança valer. A data no topo indica a versão em vigor.</p>
      </Secao>
    </Pagina>
  );
}

export function Termos() {
  return (
    <Pagina
      titulo="Termos de uso"
      resumo={<>
        <strong>Em resumo:</strong> o {MARCA} calcula <strong>estimativas</strong> de custos de documentação imobiliária. Não é cartório,
        prefeitura nem assessoria jurídica: confirme os valores antes do ato. A assinatura é trimestral, semestral ou anual; no cartão, pode ser cancelada a qualquer momento e o cancelamento vale ao fim da fidelidade.
      </>}
    >
      <Secao n={1} titulo="Aceite">
        <p>Estes termos regem o uso do site e do agente no WhatsApp do {MARCA}, operado por {operador}. Ao criar a conta, você declara que leu e aceita estes termos e a <Link to="/privacidade" className="font-bold text-acao">política de privacidade</Link>.</p>
      </Secao>

      <Secao n={2} titulo="O que o serviço faz">
        <p>O {MARCA} faz orçamentos estimados de ITBI, ITCD, emolumentos de tabelionato de notas e de registro de imóveis, taxas de bancos e correção de valores, a partir dos valores que você informa, pelo site ou pelo WhatsApp. Os cálculos usam as tabelas oficiais e as regras municipais cadastradas no serviço, na versão vigente.</p>
      </Secao>

      <Secao n={3} titulo="Os valores são estimativas">
        <Lista itens={[
          'O valor final é sempre o cobrado pelo cartório, pela prefeitura, pelo Estado ou pelo banco no dia do ato. Ele pode mudar por avaliação fiscal, qualificação do título, atos extras, diligências ou mudança de tabela.',
          'Nas cidades sem regra cadastrada, o ITBI usa a alíquota que você informa, sob a sua responsabilidade.',
          'O serviço não presta consultoria jurídica, fiscal ou registral e não substitui a análise de um profissional.',
          `Confira os valores com os órgãos responsáveis antes de assumir compromissos com seus clientes. O ${MARCA} não responde por diferenças entre a estimativa e o valor final.`,
        ]} />
      </Secao>

      <Secao n={4} titulo="Sua conta">
        <Lista itens={[
          'Você precisa ter 18 anos ou mais e informar dados verdadeiros.',
          'A conta é pessoal. O agente atende o número de WhatsApp confirmado no cadastro, e você é responsável pelo que é feito com ele e com a sua senha.',
          'Se perceber uso indevido, avise-nos imediatamente.',
        ]} />
      </Secao>

      <Secao n={5} titulo="Planos, teste e pagamento">
        <Lista itens={[
          `Não há plano mensal. Os planos são trimestral (preço cheio), semestral (10% de desconto) e anual (20% de desconto). No cartão de crédito, todo plano é cobrado mês a mês, com fidelidade de 3, 6 ou 12 meses; terminada a fidelidade, renova no mesmo plano até ser cancelado, e o cancelamento vale ao fim do mês já pago. ${PLANOS.usuario.nome}: ${preco('usuario', 'trimestral').porMesTexto}, ${preco('usuario', 'semestral').porMesTexto} ou ${preco('usuario', 'anual').porMesTexto} por mês. ${PLANOS.pro.nome}: ${preco('pro', 'trimestral').porMesTexto}, ${preco('pro', 'semestral').porMesTexto} ou ${preco('pro', 'anual').porMesTexto} por mês. No Pix, só o plano anual, pago de uma vez: ${preco('usuario', 'anual').totalTexto} (${PLANOS.usuario.nome}) ou ${preco('pro', 'anual').totalTexto} (${PLANOS.pro.nome}). Os preços vigentes ficam na página de planos.`,
          'Novas contas têm 3 dias de teste grátis, ou 5 dias com o cupom de indicação de um assinante. Terminado o teste, o acesso fica bloqueado até você assinar um plano.',
          'No cartão, a assinatura continua mês a mês depois da fidelidade, até você cancelar. No Pix, o plano anual não renova sozinho: perto do fim, você paga um novo Pix para mais um ano.',
          'Você pode pedir o cancelamento quando quiser, na página da conta. Durante a fidelidade, as mensalidades seguem até o fim dela; depois, o acesso continua até o fim do mês já pago, sem novas cobranças.',
          'Na primeira contratação, você pode desistir em até 7 dias e receber de volta o valor pago (art. 49 do Código de Defesa do Consumidor).',
          'Mudanças de preço são avisadas com pelo menos 30 dias de antecedência e valem a partir da renovação seguinte.',
        ]} />
      </Secao>

      <Secao n={6} titulo="Uso permitido">
        <p>Você concorda em não:</p>
        <Lista itens={[
          'revender, sublicenciar ou dar acesso à sua conta a terceiros;',
          'usar robôs, envio em massa ou qualquer meio que sobrecarregue o serviço ou o agente;',
          'tentar acessar dados de outras contas ou burlar as proteções do sistema;',
          'inserir dados pessoais de terceiros que não sejam necessários ao orçamento, como nome, CPF ou contato dos seus clientes;',
          'usar o serviço para fins ilegais ou para enganar clientes.',
        ]} />
      </Secao>

      <Secao n={7} titulo="Sua marca no orçamento (plano Pró)">
        <p>Ao enviar logo, cor e cabeçalho, você declara ter o direito de usá-los e nos autoriza a aplicá-los nos seus orçamentos. Esse material é usado só nos seus orçamentos.</p>
      </Secao>

      <Secao n={8} titulo="Propriedade intelectual">
        <p>A marca {MARCA}, o site, o agente, os textos e o motor de cálculo pertencem a {EMPRESA.nome}. Os orçamentos gerados são seus e podem ser enviados aos seus clientes livremente.</p>
      </Secao>

      <Secao n={9} titulo="Disponibilidade">
        <p>Trabalhamos para manter o serviço no ar o tempo todo, mas podem ocorrer interrupções para manutenção ou por falhas de fornecedores, como o WhatsApp. Quando o agente estiver fora, o site continua sendo o caminho para orçar.</p>
      </Secao>

      <Secao n={10} titulo="Responsabilidade">
        <p>Na medida permitida pela lei, a responsabilidade do {MARCA} por danos ligados ao serviço fica limitada ao valor pago por você nos 12 meses anteriores ao fato. Não respondemos por decisões tomadas com base em estimativas sem a confirmação prevista na seção 3.</p>
      </Secao>

      <Secao n={11} titulo="Suspensão e encerramento">
        <p>Podemos suspender ou encerrar contas que descumpram estes termos, com aviso prévio sempre que possível. Você pode encerrar a sua conta a qualquer momento. Antes, pode pedir a cópia do seu histórico.</p>
      </Secao>

      <Secao n={12} titulo="Mudanças e foro">
        <p>Podemos atualizar estes termos. Mudanças relevantes serão avisadas antes de valer. Estes termos seguem a lei brasileira. Fica eleito o foro de Juiz de Fora (MG), ressalvado o direito do consumidor de propor ação no foro do seu domicílio.</p>
        <p>Dúvidas: fale conosco <Contato />.</p>
      </Secao>
    </Pagina>
  );
}
