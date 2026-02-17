import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, "../data/store.json");

function defaultStore() {
  return {
    documents: [],
    highlights: [],
    notes: [],
    vocabulary: []
  };
}

function ensureStore() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultStore(), null, 2));
  }
}

export function readStore() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return defaultStore();
  }
}

export function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function nextId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
