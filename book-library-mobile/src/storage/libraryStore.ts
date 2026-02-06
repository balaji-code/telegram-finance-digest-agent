import AsyncStorage from '@react-native-async-storage/async-storage';
import { Book, DEFAULT_FOLDERS } from '../types/book';

const BOOKS_KEY = 'bookshelf-library-v1';
const FOLDERS_KEY = 'bookshelf-folders-v1';

export async function getBooks(): Promise<Book[]> {
  const raw = await AsyncStorage.getItem(BOOKS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Book[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveBooks(books: Book[]): Promise<void> {
  await AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

export async function getFolders(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FOLDERS_KEY);
  if (!raw) return [...DEFAULT_FOLDERS];

  try {
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_FOLDERS];

    const normalized = parsed
      .map((item) => String(item).trim())
      .filter(Boolean);

    return normalized.length ? Array.from(new Set(normalized)) : [...DEFAULT_FOLDERS];
  } catch {
    return [...DEFAULT_FOLDERS];
  }
}

export async function saveFolders(folders: string[]): Promise<void> {
  const normalized = folders.map((item) => item.trim()).filter(Boolean);
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(Array.from(new Set(normalized))));
}
