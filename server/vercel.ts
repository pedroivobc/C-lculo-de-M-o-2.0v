import path from "path";
import { fileURLToPath } from "url";

// Na Vercel não há fontes instaladas: aponta o fontconfig (usado pelo sharp na imagem do orçamento) para as que vão junto.
process.env.FONTCONFIG_PATH ??= path.join(path.dirname(fileURLToPath(import.meta.url)), "fontes");

const { criarApp } = await import("./app");

/** Função da Vercel: atende todas as rotas /api. O site é servido como arquivos estáticos. */
export default criarApp();
