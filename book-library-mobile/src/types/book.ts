export const DEFAULT_FOLDERS = [
  'Science',
  'Technology',
  'Mathematics',
  'History',
  'Literature',
  'Business',
  'Self-Help',
  'Other'
] as const;

export type Book = {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUri: string;
  category: string;
  price: string;
  rating: string;
  amazonUrl: string;
  createdAt: string;
};
