import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  AI_WORKER_URL: z.string().url().default("http://localhost:8000"),
  API_PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const config = schema.parse(process.env);
