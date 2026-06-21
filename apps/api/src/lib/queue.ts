import PgBoss from "pg-boss";
import { config } from "../config.js";

let bossPromise: Promise<PgBoss> | null = null;

export function getQueue(): Promise<PgBoss> {
  if (!bossPromise) {
    const b = new PgBoss(config.DATABASE_URL);
    bossPromise = b.start().then(() => b);
  }
  return bossPromise;
}

export async function enqueueProcessEntry(entryId: string): Promise<void> {
  const queue = await getQueue();
  await queue.send("process_entry", { entry_id: entryId });
}
