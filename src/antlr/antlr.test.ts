import antlr4 from "antlr4";
// @ts-ignore
import SqlBaseLexer from "./SqlBaseLexer.js";
// @ts-ignore
import SqlBaseParser from "./SqlBaseParser.js";

describe("antlr", () => {
  it("should build parse tree", () => {
    const input = "select * from emp";
    const chars = new antlr4.InputStream(input);
    const lexer = new SqlBaseLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new SqlBaseParser(tokens);
    parser.buildParseTrees = true;
    const tree = parser.statement();
    expect(tree.toStringTree).toBe("");
  });
});
