import { CharStreams, CommonTokenStream } from "antlr4ts";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser } from "./SqlBaseParser";

describe("antlr", () => {
  it("should build parse tree", () => {
    const input = "select * from emp";
    let inputStream = new UppercaseCharStream(CharStreams.fromString(input));
    let lexer = new SqlBaseLexer(inputStream);
    let tokens = new CommonTokenStream(lexer);
    let parser = new SqlBaseParser(tokens);
    parser.buildParseTree = true;
    let tree = parser.statement();
    expect(tree.toStringTree()).toBe(
      "(select*fromemp (select*fromemp (select*fromemp (select*fromemp (select*fromemp (select* select (* (* (* (* (* (* *))))))) (fromemp from (emp (emp (emp (emp (emp (emp emp)) )) )))))) ))"
    );
  });
});
