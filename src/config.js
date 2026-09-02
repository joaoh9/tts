import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PROJECT_ROOT } from "./paths.js";

let loaded = false;

export function loadEnv() {
  if (loaded) return;
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  loaded = true;
}

export function bindHost() {
  return "127.0.0.1";
}

export function bindPort(env = process.env) {
  const port = Number(env.PORT || 3333);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${env.PORT}"`);
  }
  return port;
}
