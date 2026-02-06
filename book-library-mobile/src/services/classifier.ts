const keywordMap: Record<string, string[]> = {
  Science: ['science', 'biology', 'physics', 'chemistry', 'astronomy', 'genetics'],
  Technology: ['technology', 'programming', 'software', 'computer', 'ai', 'cloud', 'coding'],
  Mathematics: ['mathematics', 'algebra', 'geometry', 'calculus', 'statistics', 'equation'],
  History: ['history', 'civilization', 'war', 'empire', 'ancient', 'revolution'],
  Literature: ['novel', 'poetry', 'literature', 'fiction', 'drama', 'story'],
  Business: ['business', 'economics', 'finance', 'marketing', 'startup', 'management'],
  'Self-Help': ['self-help', 'habit', 'mindset', 'productivity', 'motivation', 'growth'],
  Other: []
};

export function classifyBook(input: { title: string; description: string; subjects?: string[] }): string {
  const text = `${input.title} ${input.description} ${(input.subjects ?? []).join(' ')}`.toLowerCase();

  let bestCategory = 'Other';
  let bestScore = 0;

  Object.keys(keywordMap).forEach((category) => {
    if (category === 'Other') return;

    const score = keywordMap[category].reduce((acc, keyword) => {
      return text.includes(keyword) ? acc + 1 : acc;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  return bestCategory;
}
