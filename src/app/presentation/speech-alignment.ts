export function normalizeWord(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]/gu, "")
}

// Returns the next unread word. Never moves backwards or guesses from silence.
// A distant relocation requires an unambiguous final phrase of >=4 words.
export function alignTranscript(
  words: ReadonlyArray<string>,
  transcript: string,
  current: number,
  final: boolean,
): number | null {
  const spoken = transcript
    .trim()
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean)
    .slice(-24)
  if (!spoken.length) return null
  const normalized = words.map(normalizeWord)
  for (let length = Math.min(8, spoken.length); length >= 1; length--) {
    const phrase = spoken.slice(-length)
    const matches: number[] = []
    for (
      let start = Math.max(0, current - length);
      start + length <= normalized.length;
      start++
    ) {
      if (start + length <= current) continue
      if (phrase.every((word, offset) => word === normalized[start + offset]))
        matches.push(start)
    }
    const near = matches.filter(
      (start) => start <= current + (length === 1 ? 0 : 5),
    )
    if (near.length === 1 && (length >= 2 || (final && phrase[0].length >= 3)))
      return near[0] + length
    if (final && length >= 4 && matches.length === 1) return matches[0] + length
    if (length >= 4 && matches.length > 1) return null
  }
  return null
}
