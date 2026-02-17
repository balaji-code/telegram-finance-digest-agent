import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { fetchWordData } from "./vocab.js";
import { nextId, readStore, writeStore } from "./store.js";

const app = express();
const port = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsPath = path.resolve(__dirname, "../uploads");
fs.mkdirSync(uploadsPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsPath),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  }
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsPath));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/documents", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Missing file" });
    return;
  }

  const type = req.file.originalname.toLowerCase().endsWith(".epub") ? "epub" : "pdf";
  const store = readStore();
  const document = {
    id: nextId("doc"),
    title: req.body.title || req.file.originalname,
    type,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    createdAt: new Date().toISOString()
  };

  store.documents.push(document);
  writeStore(store);
  res.status(201).json(document);
});

app.get("/api/documents", (_req, res) => {
  const store = readStore();
  res.json(store.documents);
});

app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  const store = readStore();
  const existing = store.documents.find((doc) => doc.id === id);
  if (!existing) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  store.documents = store.documents.filter((doc) => doc.id !== id);
  store.highlights = store.highlights.filter((item) => item.documentId !== id);
  store.notes = store.notes.filter((item) => item.documentId !== id);
  writeStore(store);

  const filePath = path.resolve(uploadsPath, existing.fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // no-op
    }
  }

  res.json({ ok: true });
});

app.post("/api/highlights", (req, res) => {
  const { documentId, pageRef, selectedText, color = "#ffeb3b", anchor = null } = req.body;
  if (!documentId || !selectedText) {
    res.status(400).json({ error: "documentId and selectedText are required" });
    return;
  }

  const store = readStore();
  const highlight = {
    id: nextId("hl"),
    documentId,
    pageRef: pageRef || "",
    selectedText,
    color,
    anchor,
    createdAt: new Date().toISOString()
  };

  store.highlights.push(highlight);
  writeStore(store);
  res.status(201).json(highlight);
});

app.get("/api/highlights", (req, res) => {
  const { documentId } = req.query;
  const store = readStore();
  const highlights = documentId
    ? store.highlights.filter((h) => h.documentId === documentId)
    : store.highlights;
  res.json(highlights);
});

app.delete("/api/highlights/:id", (req, res) => {
  const { id } = req.params;
  const store = readStore();
  const before = store.highlights.length;
  store.highlights = store.highlights.filter((item) => item.id !== id);
  if (store.highlights.length === before) {
    res.status(404).json({ error: "Highlight not found" });
    return;
  }
  writeStore(store);
  res.json({ ok: true });
});

app.post("/api/notes", (req, res) => {
  const { documentId, highlightId = null, pageRef = "", content } = req.body;
  if (!documentId || !content) {
    res.status(400).json({ error: "documentId and content are required" });
    return;
  }

  const store = readStore();
  const note = {
    id: nextId("note"),
    documentId,
    highlightId,
    pageRef,
    content,
    createdAt: new Date().toISOString()
  };

  store.notes.push(note);
  writeStore(store);
  res.status(201).json(note);
});

app.get("/api/notes", (req, res) => {
  const { documentId } = req.query;
  const store = readStore();
  const notes = documentId ? store.notes.filter((n) => n.documentId === documentId) : store.notes;
  res.json(notes);
});

app.delete("/api/notes/:id", (req, res) => {
  const { id } = req.params;
  const store = readStore();
  const before = store.notes.length;
  store.notes = store.notes.filter((item) => item.id !== id);
  if (store.notes.length === before) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  writeStore(store);
  res.json({ ok: true });
});

app.get("/api/vocabulary/:word", async (req, res) => {
  const word = req.params.word;
  const result = await fetchWordData(word);
  if (!result) {
    res.status(400).json({ error: "Invalid word" });
    return;
  }

  const store = readStore();
  const existing = store.vocabulary.find((entry) => entry.word === result.word);
  let created = false;
  if (!existing) {
    store.vocabulary.push({ ...result, savedAt: new Date().toISOString() });
    writeStore(store);
    created = true;
  }
  res.json({ ...result, created });
});

app.get("/api/vocabulary", (_req, res) => {
  const store = readStore();
  res.json(store.vocabulary);
});

app.delete("/api/vocabulary/:word", (req, res) => {
  const word = String(req.params.word || "").toLowerCase();
  const store = readStore();
  const before = store.vocabulary.length;
  store.vocabulary = store.vocabulary.filter((item) => String(item.word || "").toLowerCase() !== word);
  if (store.vocabulary.length === before) {
    res.status(404).json({ error: "Word not found" });
    return;
  }
  writeStore(store);
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Reader backend running on http://localhost:${port}`);
});
