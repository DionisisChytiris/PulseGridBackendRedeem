import { MongoClient, Db, Collection } from "mongodb";
import { env } from "../config/env";
import type { RedeemCodeDocument } from "../types/redeemCode";

type MongoGlobal = typeof globalThis & {
  _pulsegridMongoClientPromise?: Promise<MongoClient>;
};

let client: MongoClient | null = null;
let db: Db | null = null;
let indexesReady = false;

/**
 * Connect with a cached promise on globalThis so Vercel warm invocations reuse
 * the same MongoClient instead of opening a new connection every request.
 */
export async function connectMongo(): Promise<Db> {
  if (db) {
    return db;
  }

  const g = globalThis as MongoGlobal;

  if (!g._pulsegridMongoClientPromise) {
    const mongoClient = new MongoClient(env.MONGODB_URI);
    g._pulsegridMongoClientPromise = mongoClient.connect();
  }

  client = await g._pulsegridMongoClientPromise;
  db = client.db(env.MONGODB_DB_NAME);

  if (!indexesReady) {
    await ensureIndexes(db);
    indexesReady = true;
  }

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
    indexesReady = false;
    delete (globalThis as MongoGlobal)._pulsegridMongoClientPromise;
  }
}
