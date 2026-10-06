import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { definirParametros, normalizarParametros, type Parametros } from '@/lib/calc';

/** Tabelas anuais em vigor (publicadas pelo admin). Sem resposta em 2,5 s, o site segue com as do código. */
async function carregarTabelas() {
  try {
    const r = await fetch('/api/parametros', { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return;
    const { parametros } = (await r.json()) as { parametros?: Partial<Parametros> };
    if (parametros?.emolumentos) definirParametros(normalizarParametros(parametros));
  } catch { /* segue com as tabelas do código */ }
}

carregarTabelas().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
