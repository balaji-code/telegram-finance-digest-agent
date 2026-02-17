import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  addHighlight,
  addNote,
  deleteDocument,
  deleteHighlight,
  deleteNote,
  deleteVocabularyWord,
  getDocumentUrl,
  listDocuments,
  listHighlights,
  listNotes,
  listVocabulary,
  lookupWord,
  uploadDocument
} from "./api";
import type { DocumentItem, Highlight, Note, WordInfo } from "./types";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type ReaderContextSelection = {
  x: number;
  y: number;
  text: string;
  pageRef: string;
  source: "pdf" | "epub";
  anchor?: string | null;
};

type UndoEntry =
  | { kind: "highlight"; id: string }
  | { kind: "note"; id: string }
  | { kind: "vocab"; id: string };

type ReaderJump = {
  pageRef: string;
  anchor?: string | null;
  nonce: number;
};

type RenditionLike = {
  next: () => Promise<void>;
  prev: () => Promise<void>;
  display?: (target?: string) => Promise<void>;
  destroy: () => void;
  hooks?: {
    content?: {
      register?: (fn: (contents: any) => void) => void;
    };
  };
  on?: (event: string, handler: (payload: any) => void) => void;
  annotations?: {
    highlight: (
      cfiRange: string,
      data?: Record<string, unknown>,
      cb?: (() => void) | null,
      className?: string,
      styles?: Record<string, string>
    ) => void;
    remove: (cfiRange: string, type: string) => void;
  };
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlightTextItem(raw: string, pageHighlights: Highlight[]) {
  let html = escapeHtml(raw);
  for (const item of pageHighlights) {
    const needle = item.selectedText.trim();
    if (!needle || needle.length < 2) continue;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    html = html.replace(
      regex,
      `<mark class="pdf-inline-hit" style="--pdf-hit:${item.color || "#ffe066"}">$&</mark>`
    );
  }
  return html;
}

function PdfReader({
  url,
  highlights,
  jumpTo,
  onPageChange,
  onTextContextMenu
}: {
  url: string;
  highlights: Highlight[];
  jumpTo: ReaderJump | null;
  onPageChange: (page: number) => void;
  onTextContextMenu: (selection: ReaderContextSelection) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(760);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pageRef = `Page ${page}`;
  const currentPageHighlights = useMemo(() => highlights.filter((item) => item.pageRef === pageRef), [highlights, pageRef]);

  useEffect(() => {
    setPage(1);
  }, [url]);

  useEffect(() => {
    if (!jumpTo) return;
    const match = jumpTo.pageRef.match(/Page\s+(\d+)/i);
    if (!match) return;
    const target = Number(match[1]);
    if (!Number.isFinite(target) || target < 1) return;
    setPage(target);
    onPageChange(target);
  }, [jumpTo, onPageChange]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = Math.floor(entry.contentRect.width - 32);
        if (next > 240) setWidth(next);
      }
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    // Reset sizing when page changes.
  }, [page]);

  function go(delta: number) {
    setPage((prev) => {
      const next = Math.min(Math.max(prev + delta, 1), numPages || 1);
      onPageChange(next);
      return next;
    });
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (!text) return;

    event.preventDefault();
    onTextContextMenu({
      x: event.clientX,
      y: event.clientY,
      text,
      pageRef,
      source: "pdf",
      anchor: null
    });
  }

  return (
    <div className="reader-body" ref={containerRef} onContextMenu={handleContextMenu}>
      <div className="reader-toolbar">
        <button type="button" className="nav-btn" onClick={() => go(-1)} disabled={page <= 1} aria-label="Previous page">
          ‹
        </button>
        <span>
          Page {page} / {numPages || "..."}
        </span>
        <button
          type="button"
          className="nav-btn"
          onClick={() => go(1)}
          disabled={numPages > 0 && page >= numPages}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      <div className="pdf-stage">
        <Document
          file={url}
          onLoadSuccess={({ numPages: count }) => {
            setNumPages(count);
            setPage(1);
            onPageChange(1);
          }}
          loading={<p>Loading PDF...</p>}
          error={<p>Could not render this PDF. Try another file.</p>}
        >
          <Page
            pageNumber={page}
            width={width}
            externalLinkTarget="_blank"
            externalLinkRel="noopener noreferrer"
            customTextRenderer={({ str }) => highlightTextItem(str, currentPageHighlights)}
          />
        </Document>
      </div>
    </div>
  );
}

function EpubReader({
  url,
  highlights,
  jumpTo,
  onTextContextMenu,
  onLocationChange
}: {
  url: string;
  highlights: Highlight[];
  jumpTo: ReaderJump | null;
  onTextContextMenu: (selection: ReaderContextSelection) => void;
  onLocationChange: (label: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rendition, setRendition] = useState<RenditionLike | null>(null);
  const appliedAnchorsRef = useRef<string[]>([]);

  useEffect(() => {
    let book: any;
    let currentRendition: RenditionLike | null = null;
    let mounted = true;
    let locationLabel = "EPUB section";
    const cleanups: Array<() => void> = [];

    async function renderBook() {
      const epubModule = await import("epubjs");
      const ePub = epubModule.default;
      if (!containerRef.current || !mounted) return;

      containerRef.current.innerHTML = "";
      book = ePub(url);
      const nextRendition = book.renderTo(containerRef.current, {
        width: "100%",
        height: "100%"
      }) as RenditionLike;
      currentRendition = nextRendition;

      nextRendition.on?.("relocated", (location: any) => {
        const href = location?.start?.href;
        locationLabel = href ? `Section ${href}` : "EPUB section";
        onLocationChange(locationLabel);
      });

      nextRendition.hooks?.content?.register?.((contents: any) => {
        const clickHandler = (event: MouseEvent) => {
          const target = event.target as HTMLElement | null;
          const anchor = target?.closest("a") as HTMLAnchorElement | null;
          const href = anchor?.getAttribute("href")?.trim();
          if (!href || href.startsWith("javascript:")) return;

          if (href.startsWith("http://") || href.startsWith("https://")) {
            event.preventDefault();
            window.open(href, "_blank", "noopener,noreferrer");
            return;
          }

          event.preventDefault();
          void currentRendition?.display?.(href);
        };

        const contextHandler = (event: MouseEvent) => {
          const selection = contents.window?.getSelection?.();
          const selectedText = selection?.toString?.().trim?.() ?? "";
          if (!selectedText || !containerRef.current) return;

          const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
          const cfiRange = range ? contents.cfiFromRange?.(range) ?? null : null;

          event.preventDefault();
          const readerBounds = containerRef.current.getBoundingClientRect();
          onTextContextMenu({
            x: readerBounds.left + event.clientX,
            y: readerBounds.top + event.clientY,
            text: selectedText,
            pageRef: locationLabel,
            source: "epub",
            anchor: cfiRange
          });
        };

        contents.document.addEventListener("click", clickHandler);
        contents.document.addEventListener("contextmenu", contextHandler);
        cleanups.push(() => contents.document.removeEventListener("click", clickHandler));
        cleanups.push(() => contents.document.removeEventListener("contextmenu", contextHandler));
      });

      await (nextRendition as any).display();
      setRendition(nextRendition);
      onLocationChange(locationLabel);
    }

    void renderBook();

    return () => {
      mounted = false;
      setRendition(null);
      appliedAnchorsRef.current = [];
      for (const cleanup of cleanups) cleanup();
      try {
        currentRendition?.destroy();
        book?.destroy();
      } catch {
        // no-op
      }
    };
  }, [url, onLocationChange, onTextContextMenu]);

  useEffect(() => {
    if (!rendition?.annotations) return;

    for (const cfiRange of appliedAnchorsRef.current) {
      try {
        rendition.annotations.remove(cfiRange, "highlight");
      } catch {
        // no-op
      }
    }

    const nextAnchors: string[] = [];
    const anchorHighlights = highlights.filter((item) => typeof item.anchor === "string" && item.anchor);
    for (const item of anchorHighlights) {
      const cfiRange = item.anchor as string;
      try {
        rendition.annotations.highlight(
          cfiRange,
          { id: item.id },
          null,
          "epub-saved-highlight",
          {
            fill: item.color || "#ffe066",
            "fill-opacity": "0.35",
            "mix-blend-mode": "multiply"
          }
        );
        nextAnchors.push(cfiRange);
      } catch {
        // no-op
      }
    }

    appliedAnchorsRef.current = nextAnchors;
  }, [highlights, rendition]);

  useEffect(() => {
    if (!jumpTo || !rendition?.display) return;
    if (jumpTo.anchor) {
      void rendition.display(jumpTo.anchor);
      return;
    }
    const sectionMatch = jumpTo.pageRef.match(/^Section\s+(.+)$/i);
    if (sectionMatch?.[1]) {
      void rendition.display(sectionMatch[1].trim());
    }
  }, [jumpTo, rendition]);

  return (
    <div className="reader-body">
      <div className="reader-toolbar">
        <button type="button" className="nav-btn" onClick={() => void rendition?.prev()} disabled={!rendition} aria-label="Previous">
          ‹
        </button>
        <span>EPUB Reader</span>
        <button type="button" className="nav-btn" onClick={() => void rendition?.next()} disabled={!rendition} aria-label="Next">
          ›
        </button>
      </div>
      <div className="epub-stage" ref={containerRef} />
    </div>
  );
}

function hashColorSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = (hash << 5) - hash + input.charCodeAt(i);
  const h = Math.abs(hash) % 360;
  return {
    a: `hsl(${h} 72% 46%)`,
    b: `hsl(${(h + 42) % 360} 78% 38%)`
  };
}

function renderLinkedText(text: string) {
  const regex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`${part}-${idx}`} href={part} target="_blank" rel="noreferrer" className="content-link">
          {part}
        </a>
      );
    }
    return <span key={`txt-${idx}`}>{part}</span>;
  });
}

export function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>("");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [vocabulary, setVocabulary] = useState<WordInfo[]>([]);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pageRef, setPageRef] = useState("");
  const highlightColor = "#ffe066";

  const [noteText, setNoteText] = useState("");
  const [noteHighlightId, setNoteHighlightId] = useState<string>("");

  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [readerJump, setReaderJump] = useState<ReaderJump | null>(null);

  const [contextSelection, setContextSelection] = useState<ReaderContextSelection | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocId) ?? null,
    [documents, activeDocId]
  );

  async function loadDocuments() {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      if (!activeDocId && docs.length > 0) setActiveDocId(docs[0].id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadDocData(documentId: string) {
    try {
      const [hl, nt] = await Promise.all([listHighlights(documentId), listNotes(documentId)]);
      setHighlights(hl);
      setNotes(nt);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadVocabularyList() {
    try {
      const list = await listVocabulary();
      setVocabulary(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void loadDocuments();
    void loadVocabularyList();
  }, []);

  useEffect(() => {
    if (activeDocId) void loadDocData(activeDocId);
  }, [activeDocId]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!contextSelection) return;
      if (menuRef.current?.contains(event.target as Node)) return;
      setContextSelection(null);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextSelection(null);
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [contextSelection]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      const created = await uploadDocument(uploadFile);
      setUploadFile(null);
      await loadDocuments();
      setActiveDocId(created.id);
      setPageRef(created.type === "pdf" ? "Page 1" : "EPUB section");
      setStatusMessage("Document added.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onDeleteDocument(id: string) {
    try {
      await deleteDocument(id);
      setUndoStack([]);
      const remaining = documents.filter((item) => item.id !== id);
      setDocuments(remaining);
      if (activeDocId === id) {
        const next = remaining[0];
        if (next) {
          setActiveDocId(next.id);
          await loadDocData(next.id);
        } else {
          setActiveDocId("");
          setHighlights([]);
          setNotes([]);
        }
      }
      setStatusMessage("Document deleted.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveHighlightFromSelection(text: string, ref: string, anchor?: string | null) {
    if (!activeDocId || !text.trim()) return null;
    const highlight = await addHighlight({
      documentId: activeDocId,
      pageRef: ref,
      selectedText: text.trim(),
      color: highlightColor,
      anchor: anchor ?? null
    });
    setUndoStack((prev) => [...prev, { kind: "highlight", id: highlight.id }]);
    await loadDocData(activeDocId);
    return highlight;
  }

  async function onAddNote(e: FormEvent) {
    e.preventDefault();
    if (!activeDocId || !noteText.trim()) return;

    try {
      const note = await addNote({
        documentId: activeDocId,
        highlightId: noteHighlightId || null,
        pageRef,
        content: noteText.trim()
      });
      setUndoStack((prev) => [...prev, { kind: "note", id: note.id }]);
      setNoteText("");
      setNoteHighlightId("");
      await loadDocData(activeDocId);
      setStatusMessage("Annotation saved.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onLookupWord(inputWord: string) {
    const word = inputWord.trim();
    if (!word || word.includes(" ")) {
      setError("Vocabulary lookup accepts one word at a time.");
      return;
    }

    try {
      setError("");
      const result = await lookupWord(word);
      if (result.created) {
        setUndoStack((prev) => [...prev, { kind: "vocab", id: result.word }]);
      }
      await loadVocabularyList();
      setStatusMessage(`Vocabulary loaded for '${result.word}'.`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onUndo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    try {
      if (last.kind === "highlight") {
        await deleteHighlight(last.id);
        if (activeDocId) await loadDocData(activeDocId);
      } else if (last.kind === "note") {
        await deleteNote(last.id);
        if (activeDocId) await loadDocData(activeDocId);
      } else {
        await deleteVocabularyWord(last.id);
        await loadVocabularyList();
      }
      setUndoStack((prev) => prev.slice(0, -1));
      setStatusMessage("Last action undone.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const openContextSelection = useCallback((selection: ReaderContextSelection) => {
    setError("");
    setContextSelection(selection);
    setPageRef(selection.pageRef);
  }, []);

  const setReaderLocation = useCallback((location: string) => {
    setPageRef(location);
  }, []);

  function jumpToReference(pageRefValue: string, anchor?: string | null) {
    if (!pageRefValue) return;
    setReaderJump({
      pageRef: pageRefValue,
      anchor: anchor ?? null,
      nonce: Date.now()
    });
  }

  async function onContextHighlight() {
    if (!contextSelection) return;
    try {
      setMenuBusy(true);
      await saveHighlightFromSelection(contextSelection.text, contextSelection.pageRef, contextSelection.anchor);
      setStatusMessage("Highlight saved from right-click menu.");
      setContextSelection(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMenuBusy(false);
    }
  }

  async function onContextAnnotate() {
    if (!contextSelection) return;
    try {
      setMenuBusy(true);
      const highlight = await saveHighlightFromSelection(
        contextSelection.text,
        contextSelection.pageRef,
        contextSelection.anchor
      );
      if (highlight) {
        const annotation = window.prompt("Add annotation note", `Note on: \"${contextSelection.text}\"`);
        if (annotation && annotation.trim()) {
          const note = await addNote({
            documentId: activeDocId,
            highlightId: highlight.id,
            pageRef: contextSelection.pageRef,
            content: annotation.trim()
          });
          setUndoStack((prev) => [...prev, { kind: "note", id: note.id }]);
          await loadDocData(activeDocId);
          setStatusMessage("Highlight and annotation saved.");
        } else {
          setStatusMessage("Highlight saved. Annotation skipped.");
        }
      }
      setContextSelection(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMenuBusy(false);
    }
  }

  async function onContextVocabulary() {
    if (!contextSelection) return;
    const match = contextSelection.text.match(/[A-Za-z][A-Za-z'-]*/);
    if (!match) {
      setError("Could not find a valid word in your selection.");
      return;
    }

    try {
      setMenuBusy(true);
      await onLookupWord(match[0].toLowerCase());
      setContextSelection(null);
    } finally {
      setMenuBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <div>
          <h1>Smart Reader</h1>
          <p>Read, annotate, and build vocabulary with a focused immersive workspace.</p>
        </div>
        <div className="top-actions">
          <form onSubmit={onUpload} className="upload-form">
            <input
              type="file"
              accept=".pdf,.epub"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <button type="submit">Upload</button>
          </form>
          <button type="button" className="undo-btn" onClick={() => void onUndo()} disabled={undoStack.length === 0}>
            Undo
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {statusMessage && <div className="status">{statusMessage}</div>}

      <section className="workspace">
        <aside className="panel library">
          <h2>Library</h2>
          <ul className="cover-grid">
            {documents.map((doc) => {
              const palette = hashColorSeed(doc.title || doc.originalName);
              return (
                <li key={doc.id}>
                  <button
                    className={doc.id === activeDocId ? "doc-btn active" : "doc-btn"}
                    onClick={() => setActiveDocId(doc.id)}
                    title={doc.title}
                    aria-label={`Open ${doc.title}`}
                  >
                    <span className="book-cover" style={{ ["--cover-a" as string]: palette.a, ["--cover-b" as string]: palette.b }}>
                      <small className="cover-type">{doc.type.toUpperCase()}</small>
                      <strong className="cover-initials">
                        {doc.title
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? "")
                          .join("") || "BK"}
                      </strong>
                      <span className="cover-stripe" />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="cover-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDeleteDocument(doc.id);
                    }}
                    aria-label={`Delete ${doc.title}`}
                    title="Delete document"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v9H7V9Zm4 0h2v9h-2V9Zm4 0h2v9h-2V9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="panel reader-panel">
          <h2>Reader</h2>
          {activeDocument ? (
            <>
              {activeDocument.type === "pdf" ? (
                <PdfReader
                  url={getDocumentUrl(activeDocument.fileName)}
                  highlights={highlights}
                  jumpTo={readerJump}
                  onPageChange={(page) => setPageRef(`Page ${page}`)}
                  onTextContextMenu={openContextSelection}
                />
              ) : (
                <EpubReader
                  url={getDocumentUrl(activeDocument.fileName)}
                  highlights={highlights}
                  jumpTo={readerJump}
                  onTextContextMenu={openContextSelection}
                  onLocationChange={setReaderLocation}
                />
              )}
              <p className="reader-tip">Select text and right-click to highlight, annotate, or lookup vocabulary.</p>
            </>
          ) : (
            <p>Upload and select a document to start reading.</p>
          )}
        </main>
      </section>

      <section className="collections">
        <section className="panel">
          <h2>Highlights</h2>
          <ul>
            {highlights.map((hl) => (
              <li key={hl.id} className="content-card">
                <span className="swatch" style={{ backgroundColor: hl.color }} />
                <button type="button" className="jump-link" onClick={() => jumpToReference(hl.pageRef, hl.anchor)}>
                  {hl.pageRef || "No page ref"}
                </button>
                <p>{renderLinkedText(hl.selectedText)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Notes</h2>
          <form onSubmit={onAddNote} className="stacked-form">
            <select value={noteHighlightId} onChange={(e) => setNoteHighlightId(e.target.value)}>
              <option value="">Attach to page only</option>
              {highlights.map((hl) => (
                <option key={hl.id} value={hl.id}>
                  {hl.pageRef || "No page"}: {hl.selectedText.slice(0, 30)}
                </option>
              ))}
            </select>
            <textarea placeholder="Write your note" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <button type="submit">Save note</button>
          </form>
          <ul>
            {notes.map((note) => (
              <li key={note.id} className="content-card">
                <button type="button" className="jump-link" onClick={() => jumpToReference(note.pageRef)}>
                  {note.pageRef || "No page ref"}
                </button>
                <p>{renderLinkedText(note.content)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Vocabulary</h2>
          <ul>
            {vocabulary.map((item) => (
              <li key={item.word} className="content-card">
                <strong>{item.word}</strong>
                <p>{renderLinkedText(item.meaning)}</p>
                {item.examples?.length ? (
                  <p className="usage-line">Usage: {item.examples.slice(0, 2).join(" | ")}</p>
                ) : (
                  <p className="usage-line">Usage: No examples available yet.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </section>

      {contextSelection && (
        <div
          ref={menuRef}
          className="reader-context-menu"
          style={{
            left: Math.min(contextSelection.x, window.innerWidth - 280),
            top: Math.min(contextSelection.y, window.innerHeight - 220)
          }}
        >
          <p className="menu-selection">{contextSelection.text.slice(0, 120)}</p>
          <button type="button" onClick={() => void onContextHighlight()} disabled={menuBusy}>
            Highlight
          </button>
          <button type="button" onClick={() => void onContextAnnotate()} disabled={menuBusy}>
            Annotate
          </button>
          <button type="button" onClick={() => void onContextVocabulary()} disabled={menuBusy}>
            Vocabulary
          </button>
        </div>
      )}
    </div>
  );
}
