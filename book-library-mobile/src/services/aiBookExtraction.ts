import { classifyBook } from './classifier';

export type ExtractedBook = {
  title: string;
  author: string;
  description: string;
  category: string;
  price: string;
  rating: string;
  amazonUrl: string;
};

export type ExtractBookResult =
  | { ok: true; data: ExtractedBook }
  | { ok: false; error: string };

type BackendResponse = {
  title?: string;
  author?: string;
  description?: string;
  category?: string;
  price?: string;
  rating?: string;
  amazon_url?: string;
};

export async function extractBookFromCover(base64Image: string): Promise<ExtractBookResult> {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    return { ok: false, error: 'Missing EXPO_PUBLIC_API_BASE_URL in app environment.' };
  }

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/extract-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image_base64: base64Image })
    });

    if (!response.ok) {
      let backendDetail = '';
      try {
        const errorBody = (await response.json()) as { detail?: string };
        backendDetail = errorBody.detail || '';
      } catch {
        const fallbackText = await response.text();
        backendDetail = fallbackText || '';
      }

      if (backendDetail) {
        return { ok: false, error: backendDetail };
      }

      return { ok: false, error: `Backend error (${response.status})` };
    }

    const data = (await response.json()) as BackendResponse;
    if (!data.title?.trim()) {
      return { ok: false, error: 'Backend response missing title.' };
    }

    const description = data.description?.trim() ?? '';
    const category = data.category?.trim() || classifyBook({
      title: data.title,
      description
    });

    return {
      ok: true,
      data: {
        title: data.title.trim(),
        author: data.author?.trim() || 'Unknown author',
        description,
        category,
        price: data.price?.trim() || 'N/A',
        rating: data.rating?.trim() || 'N/A',
        amazonUrl: data.amazon_url?.trim() || ''
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { ok: false, error: message };
  }
}
