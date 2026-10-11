import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { marcarPedido, tratarErro } from "./erros";
import { rotas, webhookStripe } from "./rotas";
import { garantirTabelasCarregadas } from "./tabelas";

/** API do Orçaí (sem o site): usada pelo servidor da VPS (server.ts) e pela função da Vercel (server/vercel.ts). */
export function criarApp() {
  const app = express();
  app.set("trust proxy", 1); // atrás do nginx/Caddy/Vercel: IP real para o rate limit
  app.disable("x-powered-by");
  app.use(marcarPedido);
  app.use(cabecalhosDeSeguranca());
  // Webhook da Stripe antes do JSON: a assinatura do evento é conferida sobre o corpo original.
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb" }), webhookStripe);
  // 15 MB: anexos que o agente recebe chegam em base64.
  app.use(express.json({ limit: "15mb" }));
  // Tabelas anuais publicadas pelo admin (emolumentos, INCC, ITBI de JF), conforme a vigência.
  if (config.supabaseUrl && config.supabaseServiceKey) {
    app.use("/api", (_req, _res, next) => { garantirTabelasCarregadas().finally(next); });
  }
  app.use(rotas);
  app.use(tratarErro);
  return app;
}

/**
 * Cabeçalhos de segurança (helmet). A CSP vale só em produção: o Vite de desenvolvimento usa script inline e websocket.
 * Origens liberadas: o próprio site, o Supabase (login, dados e arquivos) e o Google Fonts (src/index.css).
 */
export function cabecalhosDeSeguranca() {
  const supabase = config.supabaseUrl.replace(/\/$/, "");
  const supabaseWs = supabase.replace(/^http/, "ws");
  return helmet({
    contentSecurityPolicy: config.producao && !config.cspDesligada ? {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", ...(supabase ? [supabase] : [])],
        connectSrc: ["'self'", ...(supabase ? [supabase, supabaseWs] : [])],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false,
    // O orçamento abre numa aba nova (window.open) que depois vai para o link temporário do Supabase.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // Logo e imagens do site podem aparecer em e-mails e prévias de link.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
}
