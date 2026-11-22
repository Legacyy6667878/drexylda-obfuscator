
import { describe, expect, it } from "vitest";
import { tokenize, LexError } from "../src/lexer";

describe("DREXYLDA Lexer", () => {
  it("recognizes Luau keywords", () => {
    const tokens = tokenize("local player = nil");

    expect(tokens.map(t => t.kind)).toEqual([
      "Keyword",
      "Identifier",
      "Operator",
      "Keyword"
    ]);
  });

  it("recognizes identifiers and property names", () => {
    const tokens = tokenize("player.Character.Humanoid");

    expect(tokens.map(t => t.value)).toEqual([
      "player", ".", "Character", ".", "Humanoid"
    ]);
  });

  it("removes comments by default", () => {
    const tokens = tokenize(`
      local speed = 16 -- movement speed
      -- another comment
      return speed
    `);

    expect(tokens.some(t => t.kind === "Comment")).toBe(false);
    expect(tokens.map(t => t.value)).toContain("return");
  });

  it("can preserve comments when requested", () => {
    const tokens = tokenize("local x = 1 -- test", {
      preserveComments: true
    });

    expect(tokens.some(t => t.kind === "Comment")).toBe(true);
  });

  it("recognizes quoted strings", () => {
    const tokens = tokenize('local message = "Hello world"');

    expect(tokens.at(-1)).toMatchObject({
      kind: "String",
      value: '"Hello world"'
    });
  });

  it("recognizes escaped quotation marks", () => {
    const code = String.raw`local message = "hello \"world\""`;
    const tokens = tokenize(code);

    expect(tokens.at(-1)?.kind).toBe("String");
    expect(tokens.at(-1)?.value).toBe(String.raw`"hello \"world\""`);
  });

  it("recognizes Luau backtick strings", () => {
    const tokens = tokenize(
      "local message = `Hello {player.Name}`"
    );

    expect(tokens.at(-1)).toMatchObject({
      kind: "InterpolatedString"
    });
  });

  it("recognizes long-bracket strings", () => {
    const tokens = tokenize(
      "local text = [=[hello\nworld]=]"
    );

    expect(tokens.at(-1)).toMatchObject({
      kind: "String",
      value: "[=[hello\nworld]=]"
    });
  });

  it("recognizes decimal, hexadecimal and exponent numbers", () => {
    const tokens = tokenize(
      "local n = 42 + 0xFF + 1.25e2"
    );

    const numbers = tokens.filter(t => t.kind === "Number");

    expect(numbers.map(t => t.value)).toEqual([
      "42",
      "0xFF",
      "1.25e2"
    ]);
  });

  it("recognizes compound operators", () => {
    const tokens = tokenize(
      "count += 1; text ..= '!'; local n = a // b"
    );

    const operators = tokens
      .filter(t => t.kind === "Operator")
      .map(t => t.value);

    expect(operators).toContain("+=");
    expect(operators).toContain("..=");
    expect(operators).toContain("//");
  });

  it("tracks line and column positions", () => {
    const tokens = tokenize("local x = 1\r\nreturn x");
    const returnToken = tokens.find(t => t.value === "return");

    expect(returnToken).toMatchObject({
      line: 2,
      column: 1
    });
  });

  it("throws a LexError for an unterminated string", () => {
    expect(() => tokenize('local x = "unfinished')).toThrow(LexError);
  });

  it("throws a LexError for an unterminated long comment", () => {
    expect(() => tokenize("--[=[ unfinished comment")).toThrow(LexError);
  });
});
