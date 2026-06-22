import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { pool } from "./lib/db.js";
import { getQueue } from "./lib/queue.js";
import { authHook } from "./hooks/auth.js";

// Route imports
import authRoutes from "./routes/auth.js";
import entriesRoutes from "./routes/entries.js";
import notesRoutes from "./routes/notes.js";
import entitiesRoutes from "./routes/entities.js";
import categoriesRoutes from "./routes/categories.js";
import askRoutes from "./routes/ask.js";
import looseEndsRoutes from "./routes/looseEnds.js";
import lettersRoutes from "./routes/letters.js";
import moodRoutes from "./routes/mood.js";
import nudgesRoutes from "./routes/nudges.js";
import notificationsRoutes from "./routes/notifications.js";
import accountRoutes from "./routes/account.js";

export async function buildServer() {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  await app.register(cors, { origin: true });

  // Public endpoints
  app.get("/ping", async () => ({ status: "ok" }));

  app.get("/health", async () => {
    let dbStatus = "up";
    let queueStatus = "up";
    try {
      await pool.query("SELECT 1");
    } catch {
      dbStatus = "down";
    }
    try {
      await getQueue();
    } catch {
      queueStatus = "down";
    }
    return { status: "ok", db: dbStatus, queue: queueStatus };
  });

  // Auth routes (no JWT required)
  await app.register(authRoutes, { prefix: "/auth" });

  // Protected routes — all require valid Supabase JWT
  await app.register(async (api) => {
    api.decorateRequest("user", null);
    api.addHook("preHandler", authHook);

    await api.register(entriesRoutes);
    await api.register(notesRoutes);
    await api.register(entitiesRoutes);
    await api.register(categoriesRoutes);
    await api.register(askRoutes);
    await api.register(looseEndsRoutes);
    await api.register(lettersRoutes);
    await api.register(moodRoutes);
    await api.register(nudgesRoutes);
    await api.register(notificationsRoutes);
    await api.register(accountRoutes);
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = await buildServer();
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
}
