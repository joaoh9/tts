const SENTENCE_SPLIT = /(?<=[.!?…])\s+|\n{2,}/;

export function normalizeText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function splitForTts(text, maxChars) {
  const body = normalizeText(text);
  if (!body) return [];
  if (body.length <= maxChars) return [body];

  const pieces = body
    .split(SENTENCE_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  const flush = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const piece of pieces) {
    if (piece.length > maxChars) {
      flush();
      for (const hard of hardWrap(piece, maxChars)) chunks.push(hard);
      continue;
    }
    const next = current ? `${current} ${piece}` : piece;
    if (next.length > maxChars) {
      flush();
      current = piece;
    } else {
      current = next;
    }
  }
  flush();
  return chunks;
}

function hardWrap(text, maxChars) {
  const words = text.split(/\s+/);
  const out = [];
  let current = "";
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) out.push(current);
      current = "";
      for (let i = 0; i < word.length; i += maxChars) {
        out.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

export function isWorkbenchSidecar(text) {
  return String(text ?? "").startsWith("# tts-workbench take");
}

export function wordCount(text) {
  const trimmed = normalizeText(text);
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function estimateSeconds(text, wordsPerMinute = 150) {
  return Math.max(1, Math.round((wordCount(text) / wordsPerMinute) * 60));
}
