
import { describe, expect, it } from "vitest";
import { tokenize, LexError } from "../src/lexer";

describe("DREXYLDA Lexer", () => {
  it("recognizes keywords and identifiers", () => {
    const tokens = tokenize("local player = nil");

    expect(tokens.map(t => t.kind)).toEqual([
      "Keyword", "Identifier", "Operator", "Keyword"
    ]);
  });

  it("recognizes property names", () => {
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
  });

  it("preserves comments when requested", () => {
    const tokens = tokenize("local x = 1 -- test", {
      preserveComments: true
    });

    expect(tokens.some(t => t.kind === "Comment")).toBe(true);
  });

  it("recognizes quoted strings", () => {
    const tokens = tokenize('local message = "Hello world"');

    expect(tokens.at(-1)?.value).toBe('"Hello world"');
  });

  it("recognizes backtick strings", () => {
    const tokens = tokenize(
      "local message = `Hello {player.Name}`"
    );

    expect(tokens.at(-1)?.kind).toBe("InterpolatedString");
  });

  it("recognizes long-bracket strings", () => {
    const tokens = tokenize("local text = [=[hello world]=]");

    expect(tokens.at(-1)?.kind).toBe("String");
  });

  it("recognizes number formats", () => {
    const tokens = tokenize("local n = 42 + 0xFF + 1.25e2");

    expect(
      tokens.filter(t => t.kind === "Number").map(t => t.value)
    ).toEqual(["42", "0xFF", "1.25e2"]);
  });

  it("recognizes compound operators", () => {
    const tokens = tokenize("count += 1; text ..= '!'; local n = a // b");

    const operators = tokens
      .filter(t => t.kind === "Operator")
      .map(t => t.value);

    expect(operators).toContain("+=");
    expect(operators).toContain("..=");
    expect(operators).toContain("//");
  });

  it("tracks line and column positions", () => {
    const tokens = tokenize("local x = 1\r\nreturn x");
    const token = tokens.find(t => t.value === "return");

    expect(token?.line).toBe(2);
    expect(token?.column).toBe(1);
  });

  it("rejects unterminated strings", () => {
    expect(() => tokenize('local x = "unfinished'))
      .toThrow(LexError);
  });

  it("rejects unterminated long comments", () => {
    expect(() => tokenize("--[=[ unfinished"))
      .toThrow(LexError);
  });
});
