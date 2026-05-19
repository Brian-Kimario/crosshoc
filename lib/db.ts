import mongoose from "mongoose";
import { validateEnv } from "@/lib/env-check";

const MONGODB_URI =
  process.env.DB_CONNECTION_STRING || process.env.MONGODB_URI;

const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 10_000,
  serverSelectionTimeoutMS: 8_000,
  connectTimeoutMS: 8_000,
  heartbeatFrequencyMS: 10_000,
};

// Global connection cache — survives Next.js hot reloads in dev
// and is reused across serverless function invocations in prod.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | null;
  // eslint-disable-next-line no-var
  var _mongoosePromise: Promise<typeof mongoose> | null;
}

let cached = global._mongooseConn;
let promise = global._mongoosePromise;

export default async function dbConnect(): Promise<typeof mongoose> {
  validateEnv();

  if (cached) return cached;

  if (!promise) {
    const maskedUri = (MONGODB_URI as string).replace(
      /mongodb\+srv:\/\/([^:]+):[^@]+@/,
      'mongodb+srv://$1:***@'
    );
    promise = mongoose
      .connect(MONGODB_URI as string, MONGOOSE_OPTIONS)
      .then((m) => {
        return m;
      })
      .catch((e) => {
        console.error("[DB] Connection failed:", e.message);
        throw e;
      });
    global._mongoosePromise = promise;
  }

  try {
    cached = await promise;
    global._mongooseConn = cached;
  } catch (e) {
    // Reset so the next request retries
    promise = null;
    global._mongoosePromise = null;
    throw e;
  }

  return cached;
}
