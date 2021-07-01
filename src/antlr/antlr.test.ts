import { CharStreams, CommonTokenStream } from "antlr4ts";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";

describe("antlr", () => {
  it("should build parse tree", () => {
    const input = "select * from emp";
    let inputStream = CharStreams.fromString(input);
    const lexer = new SqlBaseLexer(inputStream);
    const tokens = new CommonTokenStream(lexer);
    const parser = new SqlBaseParser(tokens);
    parser.buildParseTree = true;
    const tree = parser.statement();
    expect(tree.toStringTree()).toBe("");
  });
});
