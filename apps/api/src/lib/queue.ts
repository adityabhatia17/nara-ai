import PgBoss from "pg-boss";
import { config } from "../config.js";

const PROCESS_ENTRY_QUEUE = "process_entry";

let bossPromise: Promise<PgBoss> | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (!bossPromise) {
    const b = new PgBoss(config.DATABASE_URL);
    bossPromise = b.start().then(async () => {
      await b.createQueue(PROCESS_ENTRY_QUEUE);
      return b;
    });
  }
  return bossPromise;
}

export async function enqueueProcessEntry(entryId: string): Promise<void> {
  const queue = await getQueue();
  const jobId = await queue.send(PROCESS_ENTRY_QUEUE, { entry_id: entryId });
  if (!jobId) {
    throw new Error(`Failed to enqueue process_entry job for entry ${entryId}`);
  }
}
