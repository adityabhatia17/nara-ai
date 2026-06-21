import PgBoss from "pg-boss";
import { config } from "../config.js";

let boss: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(config.DATABASE_URL);
    await boss.start();
  }
  return boss;
}

export async function enqueueProcessEntry(entryId: string): Promise<void> {
  const queue = await getQueue();
  await queue.send("process_entry", { entry_id: entryId });
}
