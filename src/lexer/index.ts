
export type TokenKind =
  | "Keyword"
  | "Identifier"
  | "Number"
  | "String"
  | "InterpolatedString"
  | "Operator"
  | "Punctuation"
  | "Comment";

export interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface LexerOptions {
  preserveComments?: boolean;
}

export class LexError extends Error {
  constructor(
    message: string,
    public readonly offset: number,
    public readonly line: number,
    public readonly column: number
  ) {
    super(`${message} at ${line}:${column}`);
    this.name = "LexError";
  }
}

const KEYWORDS = new Set([
  "and", "break", "continue", "do", "else",
  "elseif", "end", "export", "false", "for",
  "function", "if", "in", "local", "nil",
  "not", "or", "repeat", "return", "then",
  "true", "type", "until", "while"
]);

const OPERATORS = [
  "...", "..=", "//=", "<<=", ">>=",
  "+=", "-=", "*=", "/=", "%=", "^=",
  "==", "~=", "<=", ">=", "//", "<<",
  ">>", "::", "->", ".."
].sort((a, b) => b.length - a.length);

const SINGLE_OPERATORS = new Set([
  "+", "-", "*", "/", "%", "^", "#",
  "&", "~", "|", "<", ">", "=", ":", "?", "!"
]);

const PUNCTUATION = new Set([
  "(", ")", "{", "}", "[", "]",
  ";", ",", "."
]);

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isHexDigit(char: string | undefined): boolean {
  return char !== undefined &&
    /^[0-9a-fA-F]$/.test(char);
}

function isIdentifierStart(
  char: string | undefined
): boolean {
  return char !== undefined &&
    /^[A-Za-z_]$/.test(char);
}

function isIdentifierPart(
  char: string | undefined
): boolean {
  return char !== undefined &&
    /^[A-Za-z0-9_]$/.test(char);
}

function isWhitespace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\v" ||
    char === "\f"
  );
}

interface LongBracket {
  contentStart: number;
  close: string;
}

function getLongBracket(
  source: string,
  start: number
): LongBracket | null {
  if (source[start] !== "[") return null;

  let cursor = start + 1;

  while (source[cursor] === "=") {
    cursor++;
  }

  if (source[cursor] !== "[") return null;

  const equals = source.slice(start + 1, cursor);

  return {
    contentStart: cursor + 1,
    close: `]${equals}]`
  };
}

function readQuotedString(
  source: string,
  start: number
): number {
  const quote = source[start];
  let cursor = start + 1;

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === "\\") {
      cursor++;

      if (cursor < source.length && source[cursor] === "\r") {
        cursor++;

        if (source[cursor] === "\n") {
          cursor++;
        }
      } else {
        cursor++;
      }

      continue;
    }

    if (char === quote) {
      return cursor + 1;
    }

    if (char === "\n" || char === "\r") {
      throw new Error("Unescaped newline in quoted string");
    }

    cursor++;
  }

  throw new Error("Unterminated quoted string");
}

function readInterpolatedString(
  source: string,
  start: number
): number {
  let cursor = start + 1;

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === "\\") {
      cursor += 2;
      continue;
    }

    if (char === "`") {
      return cursor + 1;
    }

    cursor++;
  }

  throw new Error("Unterminated interpolated string");
}

function readLongLiteral(
  source: string,
  start: number
): number {
  const bracket = getLongBracket(source, start);

  if (!bracket) {
    throw new Error("Invalid long-bracket opening");
  }

  const closeIndex = source.indexOf(
    bracket.close,
    bracket.contentStart
  );

  if (closeIndex === -1) {
    throw new Error("Unterminated long-bracket literal");
  }

  return closeIndex + bracket.close.length;
}

function readComment(
  source: string,
  start: number
): number {
  const bracket = getLongBracket(source, start + 2);

  if (bracket) {
    const closeIndex = source.indexOf(
      bracket.close,
      bracket.contentStart
    );

    if (closeIndex === -1) {
      throw new Error("Unterminated long-bracket comment");
    }

    return closeIndex + bracket.close.length;
  }

  let cursor = start + 2;

  while (
    cursor < source.length &&
    source[cursor] !== "\n" &&
    source[cursor] !== "\r"
  ) {
    cursor++;
  }

  return cursor;
}

function readNumber(
  source: string,
  start: number
): number {
  let cursor = start;

  const consumeWhile = (
    predicate: (char: string | undefined) => boolean
  ) => {
    while (predicate(source[cursor])) {
      cursor++;
    }
  };

  if (
    source[cursor] === "0" &&
    (source[cursor + 1] === "x" ||
      source[cursor + 1] === "X")
  ) {
    cursor += 2;
    consumeWhile(char => isHexDigit(char) || char === "_");

    if (
      source[cursor] === "." &&
      source[cursor + 1] !== "."
    ) {
      cursor++;
      consumeWhile(char => isHexDigit(char) || char === "_");
    }

    if (
      source[cursor] === "p" ||
      source[cursor] === "P"
    ) {
      cursor++;

      if (
        source[cursor] === "+" ||
        source[cursor] === "-"
      ) {
        cursor++;
      }

      consumeWhile(char => isDigit(char) || char === "_");
    }

    return cursor;
  }

  if (
    source[cursor] === "0" &&
    (source[cursor + 1] === "b" ||
      source[cursor + 1] === "B")
  ) {
    cursor += 2;

    consumeWhile(
      char => char === "0" || char === "1" || char === "_"
    );

    return cursor;
  }

  if (source[cursor] === ".") {
    cursor++;
    consumeWhile(char => isDigit(char) || char === "_");
  } else {
    consumeWhile(char => isDigit(char) || char === "_");

    if (
      source[cursor] === "." &&
      source[cursor + 1] !== "."
    ) {
      cursor++;
      consumeWhile(char => isDigit(char) || char === "_");
    }
  }

  if (
    source[cursor] === "e" ||
    source[cursor] === "E"
  ) {
    cursor++;

    if (
      source[cursor] === "+" ||
      source[cursor] === "-"
    ) {
      cursor++;
    }

    consumeWhile(char => isDigit(char) || char === "_");
  }

  return cursor;
}

export function tokenize(
  source: string,
  options: LexerOptions = {}
): Token[] {
  const tokens: Token[] = [];

  let offset = 0;
  let line = 1;
  let column = 1;

  function fail(message: string): never {
    throw new LexError(message, offset, line, column);
  }

  function advance(end: number): void {
    const text = source.slice(offset, end);

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === "\r") {
        if (text[i + 1] === "\n") {
          i++;
        }

        line++;
        column = 1;
      } else if (char === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
    }

    offset = end;
  }

  function emit(kind: TokenKind, end: number): void {
    tokens.push({
      kind,
      value: source.slice(offset, end),
      start: offset,
      end,
      line,
      column
    });

    advance(end);
  }

  while (offset < source.length) {
    const char = source[offset];

    if (isWhitespace(char)) {
      let end = offset + 1;

      while (
        end < source.length &&
        isWhitespace(source[end])
      ) {
        end++;
      }

      advance(end);
      continue;
    }

    if (source.startsWith("--", offset)) {
      let end: number;

      try {
        end = readComment(source, offset);
      } catch (error) {
        fail(
          error instanceof Error
            ? error.message
            : "Invalid comment"
        );
      }

      if (options.preserveComments) {
        emit("Comment", end);
      } else {
        advance(end);
      }

      continue;
    }

    if (char === "'" || char === '"') {
      let end: number;

      try {
        end = readQuotedString(source, offset);
      } catch (error) {
        fail(
          error instanceof Error
            ? error.message
            : "Invalid string"
        );
      }

      emit("String", end);
      continue;
    }

    if (char === "`") {
      let end: number;

      try {
        end = readInterpolatedString(source, offset);
      } catch (error) {
        fail(
          error instanceof Error
            ? error.message
            : "Invalid interpolated string"
        );
      }

      emit("InterpolatedString", end);
      continue;
    }

    if (char === "[") {
      const bracket = getLongBracket(source, offset);

      if (bracket) {
        let end: number;

        try {
          end = readLongLiteral(source, offset);
        } catch (error) {
          fail(
            error instanceof Error
              ? error.message
              : "Invalid long-bracket literal"
          );
        }

        emit("String", end);
        continue;
      }
    }

    if (isIdentifierStart(char)) {
      let end = offset + 1;

      while (isIdentifierPart(source[end])) {
        end++;
      }

      const value = source.slice(offset, end);

      emit(
        KEYWORDS.has(value) ? "Keyword" : "Identifier",
        end
      );

      continue;
    }

    if (
      isDigit(char) ||
      (char === "." && isDigit(source[offset + 1]))
    ) {
      const end = readNumber(source, offset);

      emit("Number", end);
      continue;
    }

    const operator = OPERATORS.find(op =>
      source.startsWith(op, offset)
    );

    if (operator) {
      emit("Operator", offset + operator.length);
      continue;
    }

    if (SINGLE_OPERATORS.has(char)) {
      emit("Operator", offset + 1);
      continue;
    }

    if (PUNCTUATION.has(char)) {
      emit("Punctuation", offset + 1);
      continue;
    }

    fail(`Unexpected character ${JSON.stringify(char)}`);
  }

  return tokens;
}
