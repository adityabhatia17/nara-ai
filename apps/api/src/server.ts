import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";

export async function buildServer() {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({
    status: "ok",
    db: "up",
    queue: "up",
  }));

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = await buildServer();
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
}
