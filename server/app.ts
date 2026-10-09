import express from "express";
import { config } from "./config";
import { rotas } from "./rotas";
import { garantirTabelasCarregadas } from "./tabelas";

/** API do Orçaí (sem o site): usada pelo servidor da VPS (server.ts) e pela função da Vercel (server/vercel.ts). */
export function criarApp() {
  const app = express();
  app.set("trust proxy", 1); // atrás do Caddy/Traefik/Vercel: IP real para o rate limit
  // 15 MB: anexos que o agente recebe chegam em base64.
  app.use(express.json({ limit: "15mb" }));
  // Tabelas anuais publicadas pelo admin (emolumentos, INCC, ITBI de JF), conforme a vigência.
  if (config.supabaseUrl && config.supabaseServiceKey) {
    app.use("/api", (_req, _res, next) => { garantirTabelasCarregadas().finally(next); });
  }
  app.use(rotas);
  return app;
}
