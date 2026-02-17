import type { DocumentItem, Highlight, Note, WordInfo, WordLookupResult } from "./types";

const API_BASE = "/api";
const FILE_BASE = "/uploads";

export function getDocumentUrl(fileName: string) {
  return `${FILE_BASE}/${fileName}`;
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const response = await fetch(`${API_BASE}/documents`);
  if (!response.ok) throw new Error("Failed to load documents");
  return response.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Failed to delete document");
}

export async function uploadDocument(file: File, title?: string): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);

  const response = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) throw new Error("Failed to upload document");
  return response.json();
}

export async function listHighlights(documentId: string): Promise<Highlight[]> {
  const response = await fetch(`${API_BASE}/highlights?documentId=${encodeURIComponent(documentId)}`);
  if (!response.ok) throw new Error("Failed to load highlights");
  return response.json();
}

export async function deleteHighlight(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/highlights/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Failed to delete highlight");
}

export async function addHighlight(payload: {
  documentId: string;
  pageRef: string;
  selectedText: string;
  color?: string;
  anchor?: string | null;
}): Promise<Highlight> {
  const response = await fetch(`${API_BASE}/highlights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Failed to save highlight");
  return response.json();
}

export async function listNotes(documentId: string): Promise<Note[]> {
  const response = await fetch(`${API_BASE}/notes?documentId=${encodeURIComponent(documentId)}`);
  if (!response.ok) throw new Error("Failed to load notes");
  return response.json();
}

export async function deleteNote(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/notes/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Failed to delete note");
}

export async function addNote(payload: {
  documentId: string;
  highlightId?: string | null;
  pageRef?: string;
  content: string;
}): Promise<Note> {
  const response = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Failed to save note");
  return response.json();
}

export async function lookupWord(word: string): Promise<WordLookupResult> {
  const response = await fetch(`${API_BASE}/vocabulary/${encodeURIComponent(word)}`);
  if (!response.ok) throw new Error("Failed to lookup word");
  return response.json();
}

export async function deleteVocabularyWord(word: string): Promise<void> {
  const response = await fetch(`${API_BASE}/vocabulary/${encodeURIComponent(word)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Failed to delete vocabulary word");
}

export async function listVocabulary(): Promise<WordInfo[]> {
  const response = await fetch(`${API_BASE}/vocabulary`);
  if (!response.ok) throw new Error("Failed to load vocabulary");
  return response.json();
}
