// Converts spoken-out clause/section references ("six dot one dot two",
// "five point one point four") into their digit form ("6.1.2", "5.1.4")
// before a transcribed voice question is embedded for similarity search.
//
// Vapi's speech-to-text renders a spoken clause number as literal words, but
// the source documents spell the same reference as digits — see
// lib/rag/prompt.ts's SYSTEM_PROMPT, which asks the LLM to speak clause
// numbers back out the same way for the opposite reason (TTS reads bare
// digit-dot-digit patterns unreliably). This is the input-side mirror of
// that fix: without it, the embedded query and the embedded chunk diverge
// lexically enough that a genuinely relevant chunk can fall below the
// similarity thresholds in classifyRetrieval.

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9,
};

const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SEPARATOR_WORDS = new Set(["dot", "point"]);

type WordToken = { text: string; start: number; end: number };

function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = /[A-Za-z]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    tokens.push({ text: match[0].toLowerCase(), start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

// Parses one number word (or "twenty one"-style tens+ones pair) starting at
// token index i. Returns null if tokens[i] isn't a number word at all, so
// callers can tell "not a number here" apart from "number here".
function parseNumberGroup(tokens: WordToken[], i: number): { value: number; nextIndex: number } | null {
  const word = tokens[i]?.text;
  if (word === undefined) return null;

  if (word in TENS) {
    const next = tokens[i + 1]?.text;
    if (next !== undefined && next in ONES && ONES[next] !== 0) {
      return { value: TENS[word] + ONES[next], nextIndex: i + 2 };
    }
    return { value: TENS[word], nextIndex: i + 1 };
  }
  if (word in TEENS) {
    return { value: TEENS[word], nextIndex: i + 1 };
  }
  if (word in ONES) {
    return { value: ONES[word], nextIndex: i + 1 };
  }
  return null;
}

export function normalizeSpokenClauseNumbers(text: string): string {
  const tokens = tokenize(text);
  if (tokens.length === 0) return text;

  const replacements: { start: number; end: number; digits: string }[] = [];

  let i = 0;
  while (i < tokens.length) {
    const first = parseNumberGroup(tokens, i);
    if (!first) {
      i += 1;
      continue;
    }

    const values = [first.value];
    let cursor = first.nextIndex;
    let lastGroupEndIndex = first.nextIndex - 1;

    // Greedily consume (dot|point NumberGroup)+ — at least one separator is
    // required (below) before this counts as a clause reference, so a lone
    // number word in ordinary text ("buy one get one") is never touched.
    while (tokens[cursor] && SEPARATOR_WORDS.has(tokens[cursor].text)) {
      const group = parseNumberGroup(tokens, cursor + 1);
      if (!group) break;
      values.push(group.value);
      lastGroupEndIndex = group.nextIndex - 1;
      cursor = group.nextIndex;
    }

    if (values.length >= 2) {
      replacements.push({
        start: tokens[i].start,
        end: tokens[lastGroupEndIndex].end,
        digits: values.join("."),
      });
      i = cursor;
    } else {
      i += 1;
    }
  }

  if (replacements.length === 0) return text;

  let result = "";
  let cursorPos = 0;
  for (const { start, end, digits } of replacements) {
    result += text.slice(cursorPos, start) + digits;
    cursorPos = end;
  }
  result += text.slice(cursorPos);
  return result;
}
