/*
 * Service worker do Orçaí Imob (PWA).
 * - Páginas: rede primeiro; sem internet, abre o app guardado (as calculadoras funcionam offline).
 * - /assets/*: arquivos com hash no nome, guardados para sempre.
 * - API (/api) e Supabase: nunca guardados (dados da conta e login sempre da rede).
 */
const VERSAO = 'orcai-v1';
const ESSENCIAIS = ['/', '/manifest.webmanifest', '/marca/simbolo.svg', '/icones/icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put('/', copia)); return r; })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((cache) => cache ?? fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return r;
    })));
    return;
  }

  // Ícones, marca e demais arquivos: mostra o guardado e atualiza por trás.
  e.respondWith(caches.match(req).then((cache) => {
    const daRede = fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => cache);
    return cache ?? daRede;
  }));
});
