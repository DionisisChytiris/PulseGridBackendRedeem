import { MongoClient, Db, Collection } from "mongodb";
import { env } from "../config/env";
import type { RedeemCodeDocument } from "../types/redeemCode";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  db = client.db(env.MONGODB_DB_NAME);

  await ensureIndexes(db);

  console.log(`Connected to MongoDB database: ${env.MONGODB_DB_NAME}`);
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB is not connected. Call connectMongo() first.");
  }
  return db;
}

export function getRedeemCodesCollection(): Collection<RedeemCodeDocument> {
  return getDb().collection<RedeemCodeDocument>("redeem_codes");
}

/**
 * Indexes are critical for correctness and performance.
 * - unique codeHash: guarantees no duplicate codes at the DB level
 * - status / createdAt: support listing and filtering
 */
async function ensureIndexes(database: Db): Promise<void> {
  const collection = database.collection<RedeemCodeDocument>("redeem_codes");

  await collection.createIndexes([
    { key: { codeHash: 1 }, unique: true, name: "uniq_codeHash" },
    { key: { status: 1 }, name: "idx_status" },
    { key: { createdAt: -1 }, name: "idx_createdAt" },
  ]);
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
