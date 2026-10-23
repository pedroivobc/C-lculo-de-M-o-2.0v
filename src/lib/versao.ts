import { lazy, useEffect, type ComponentType } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Versão nova do site sem precisar de Ctrl+Shift+R: uma aba (ou o app instalado) aberta antes de uma atualização
 * continua rodando o código antigo. Aqui o site compara o seu arquivo principal com o da página publicada e, quando
 * mudou, recarrega na próxima troca de tela (sem perder o que a pessoa está digitando) ou ao voltar ao app depois de
 * um tempo fora.
 */

const ENTRADA = /\/assets\/index-[\w-]+\.js/;
const INTERVALO = 10 * 60_000;
const FORA_POR = 15 * 60_000;
const CHAVE_RECARGA = 'orcai-recarregado';

let atual: string | null = null;
let novaVersao = false;
let checando = false;

async function checar() {
  if (!atual || novaVersao || checando) return;
  checando = true;
  try {
    const html = await fetch(`/?versao=${Date.now()}`, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : ''));
    const publicada = html.match(ENTRADA)?.[0];
    if (publicada && publicada !== atual) novaVersao = true;
  } catch { /* sem internet: tenta de novo depois */ } finally { checando = false; }
}

function iniciar() {
  if (atual !== null || !import.meta.env.PROD) return;
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  atual = script ? new URL(script.src).pathname : '';
  if (!atual) return;

  let saiuEm = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { saiuEm = Date.now(); return; }
    const longe = saiuEm && Date.now() - saiuEm > FORA_POR;
    checar().then(() => { if (novaVersao && longe) window.location.reload(); });
  });
  setInterval(checar, INTERVALO);
  checar();
}

/** Liga a checagem e recarrega na troca de tela quando há versão nova. Vai uma vez, dentro do roteador. */
export function useVersaoNova() {
  const { pathname } = useLocation();
  useEffect(iniciar, []);
  useEffect(() => {
    if (novaVersao) window.location.reload();
  }, [pathname]);
}

/**
 * Tela carregada sob demanda que se recupera de uma atualização: se o arquivo dela já não existe no servidor
 * (aba antiga), recarrega a página uma vez para pegar a versão nova em vez de travar.
 */
export function telaSobDemanda<T extends ComponentType<any>>(carregar: () => Promise<{ default: T }>) {
  return lazy(() => carregar().then((m) => {
    try { sessionStorage.removeItem(CHAVE_RECARGA); } catch { /* sem armazenamento */ }
    return m;
  }).catch((erro) => {
    let jaTentou = true;
    try { jaTentou = !!sessionStorage.getItem(CHAVE_RECARGA); sessionStorage.setItem(CHAVE_RECARGA, '1'); } catch { /* sem armazenamento */ }
    if (!jaTentou) { window.location.reload(); return new Promise<never>(() => {}); }
    throw erro;
  }));
}
