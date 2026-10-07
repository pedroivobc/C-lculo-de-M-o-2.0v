/**
 * Build para a Vercel (Build Output API v3): o site vira arquivos estáticos e a API (Express) vira uma
 * função. Roda no lugar do `vite build` quando o projeto está na Vercel (ver vercel.json).
 *
 *   .vercel/output/static/                 → dist/ do Vite
 *   .vercel/output/functions/api.func/     → server/vercel.ts empacotado + sharp + fontes
 *   .vercel/output/config.json             → /api/* vai para a função; o resto, para o site
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const saida = path.join(raiz, '.vercel/output');
const funcao = path.join(saida, 'functions/api.func');
const rodar = (cmd, cwd = raiz) => execSync(cmd, { cwd, stdio: 'inherit' });

rmSync(saida, { recursive: true, force: true });

// 1) Site
rodar('npx vite build');
cpSync(path.join(raiz, 'dist'), path.join(saida, 'static'), { recursive: true });

// 2) API: um arquivo só, com tudo dentro menos o sharp (binário nativo, instalado à parte para Linux).
mkdirSync(funcao, { recursive: true });
await build({
  entryPoints: [path.join(raiz, 'server/vercel.ts')],
  outfile: path.join(funcao, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['sharp', 'vite'],
  // Dependências em CommonJS chamam require(); em ESM ele precisa ser criado.
  banner: { js: "import { createRequire as __criarRequire } from 'module'; const require = __criarRequire(import.meta.url);" },
  logLevel: 'warning',
});
cpSync(path.join(raiz, 'server/fontes'), path.join(funcao, 'fontes'), { recursive: true });

const versaoSharp = JSON.parse(readFileSync(path.join(raiz, 'node_modules/sharp/package.json'), 'utf8')).version;
writeFileSync(path.join(funcao, 'package.json'), JSON.stringify({ type: 'module', private: true, dependencies: { sharp: versaoSharp } }, null, 2));
rodar('npm install --omit=dev --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc', funcao);

writeFileSync(path.join(funcao, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  memory: 1024,
  maxDuration: 60,
}, null, 2));

// 3) Rotas
writeFileSync(path.join(saida, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
    // PWA: o service worker e o manifesto sempre conferidos (senão a atualização do app demora a chegar).
    { src: '^/sw\\.js$', headers: { 'cache-control': 'no-cache', 'service-worker-allowed': '/' }, continue: true },
    { src: '^/manifest\\.webmanifest$', headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-cache' }, continue: true },
    { handle: 'filesystem' },
    { src: '^/api(/.*)?$', dest: '/api' },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
}, null, 2));

console.log('Vercel: site e API prontos em .vercel/output');
