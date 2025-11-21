import { config } from "../config";
import { PgStore } from "./pgStore";
import { StoreAdapter } from "./storeAdapter";

export async function createStore(): Promise<StoreAdapter> {
  if (!config.postgresUrl) {
    throw new Error("POSTGRES_URL is required to use the Postgres vector store. Set it in your .env.");
  }
  const store = new PgStore();
  await store.ensureSchema();
  return store;
}
