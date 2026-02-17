export async function fetchWordData(word) {
  const cleanWord = String(word || "").trim().toLowerCase();
  if (!cleanWord) {
    return null;
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    if (!response.ok) {
      return fallbackWord(cleanWord);
    }

    const payload = await response.json();
    const first = payload?.[0];
    const firstMeaning = first?.meanings?.[0];
    const firstDefinition = firstMeaning?.definitions?.[0];

    return {
      word: cleanWord,
      phonetic: first?.phonetic ?? "",
      partOfSpeech: firstMeaning?.partOfSpeech ?? "",
      meaning: firstDefinition?.definition ?? "Meaning unavailable.",
      examples: (firstMeaning?.definitions || [])
        .map((entry) => entry.example)
        .filter(Boolean)
        .slice(0, 5)
    };
  } catch {
    return fallbackWord(cleanWord);
  }
}

function fallbackWord(word) {
  return {
    word,
    phonetic: "",
    partOfSpeech: "",
    meaning: "Unable to fetch dictionary result right now. Try again later.",
    examples: []
  };
}
