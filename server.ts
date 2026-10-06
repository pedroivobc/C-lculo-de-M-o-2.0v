import express from "express";
import path from "path";
import { config } from "./server/config";
import { rotas } from "./server/rotas";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1); // atrás do Caddy/Traefik: IP real para o rate limit

  // 15 MB: anexos que o agente recebe chegam em base64.
  app.use(express.json({ limit: "15mb" }));
  app.use(rotas);

  if (process.env.NODE_ENV !== "production") {
    // Import dinâmico: o Vite só existe em desenvolvimento.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

startServer();
