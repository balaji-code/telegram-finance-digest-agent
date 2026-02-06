export type BookMetadata = {
  title: string;
  author: string;
  description: string;
  subjects: string[];
  coverUri: string;
};

function toText(description: unknown): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  if (typeof description === 'object' && description && 'value' in description) {
    const value = (description as { value?: unknown }).value;
    return typeof value === 'string' ? value : '';
  }
  return '';
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type OpenLibraryBook = {
  title?: string;
  description?: string | { value?: string };
  subjects?: string[];
  covers?: number[];
  authors?: { key: string }[];
};

type OpenLibraryAuthor = {
  name?: string;
};

type GoogleBooksResponse = {
  items?: Array<{
    volumeInfo?: {
      title?: string;
      authors?: string[];
      description?: string;
      categories?: string[];
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }>;
};

async function fromOpenLibrary(isbn: string): Promise<BookMetadata | null> {
  const book = await fetchJson<OpenLibraryBook>(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!book?.title) return null;

  let author = 'Unknown author';
  if (book.authors?.length) {
    const primaryAuthor = await fetchJson<OpenLibraryAuthor>(`https://openlibrary.org${book.authors[0].key}.json`);
    if (primaryAuthor?.name) {
      author = primaryAuthor.name;
    }
  }

  const coverUri = book.covers?.[0]
    ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
    : `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

  return {
    title: book.title,
    author,
    description: toText(book.description),
    subjects: book.subjects ?? [],
    coverUri
  };
}

async function fromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  const payload = await fetchJson<GoogleBooksResponse>(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
  );

  const info = payload?.items?.[0]?.volumeInfo;
  if (!info?.title) return null;

  const maybeCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? '';
  const coverUri = maybeCover.replace('http://', 'https://');

  return {
    title: info.title,
    author: info.authors?.[0] ?? 'Unknown author',
    description: info.description ?? '',
    subjects: info.categories ?? [],
    coverUri
  };
}

export async function lookupBookByIsbn(isbn: string): Promise<BookMetadata | null> {
  const openLibrary = await fromOpenLibrary(isbn);
  if (openLibrary) return openLibrary;

  const google = await fromGoogleBooks(isbn);
  if (google) return google;

  return null;
}
