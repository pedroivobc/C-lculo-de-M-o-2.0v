import express from "express";
import path from "path";
import { config } from "./server/config";
import { criarApp } from "./server/app";
import { garantirTabelasCarregadas } from "./server/tabelas";

/** Servidor completo (VPS ou desenvolvimento): API + site. Na Vercel, quem atende a API é server/vercel.ts. */
async function startServer() {
  const app = criarApp();

  if (process.env.NODE_ENV !== "production") {
    // Import dinâmico: o Vite só existe em desenvolvimento.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (config.supabaseUrl && config.supabaseServiceKey) garantirTabelasCarregadas();

  // HOST=127.0.0.1 quando um proxy no próprio servidor atende o HTTPS (infra/app-servidor).
  app.listen(config.port, process.env.HOST || "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

startServer();
