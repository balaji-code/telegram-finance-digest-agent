export type DocumentItem = {
  id: string;
  title: string;
  type: "pdf" | "epub";
  fileName: string;
  originalName: string;
  createdAt: string;
};

export type Highlight = {
  id: string;
  documentId: string;
  pageRef: string;
  selectedText: string;
  color: string;
  anchor?: string | null;
  createdAt: string;
};

export type Note = {
  id: string;
  documentId: string;
  highlightId: string | null;
  pageRef: string;
  content: string;
  createdAt: string;
};

export type WordInfo = {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  examples: string[];
};

export type WordLookupResult = WordInfo & {
  created: boolean;
};
