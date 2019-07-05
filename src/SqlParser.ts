import { createToken, Lexer, CstParser } from "chevrotain";
import { matchFunctionName } from "./matchFunctionName";

const Identifier = createToken({
  name: "Identifier",
  pattern: /[a-zA-Z]\w*|"[\w "{2}]*"/
});

const FunctionIdentifier = createToken({
  name: "FunctionIdentifier",
  pattern: matchFunctionName,
  line_breaks: false
});

// We specify the "longer_alt" property to resolve keywords vs identifiers ambiguity.
// See: https://github.com/SAP/chevrotain/blob/master/examples/lexer/keywords_vs_identifiers/keywords_vs_identifiers.js
const Select = createToken({
  name: "Select",
  pattern: /SELECT/i,
  longer_alt: Identifier
});

const From = createToken({
  name: "From",
  pattern: /FROM/i,
  longer_alt: Identifier
});

const Where = createToken({
  name: "Where",
  pattern: /WHERE/i,
  longer_alt: Identifier
});

const Values = createToken({
  name: "Values",
  pattern: /VALUES/i,
  longer_alt: Identifier
});

const And = createToken({
  name: "And",
  pattern: /AND/i,
  longer_alt: Identifier
});

const Or = createToken({
  name: "Or",
  pattern: /OR/i,
  longer_alt: Identifier
});

const IsNull = createToken({
  name: "IsNull",
  pattern: /IS NULL/i,
  longer_alt: Identifier
});

const IsNotNull = createToken({
  name: "IsNotNull",
  pattern: /IS NOT NULL/i,
  longer_alt: Identifier
});

const Comma = createToken({ name: "Comma", pattern: /,/ });
const Period = createToken({ name: "Period", pattern: /\./ });
const LSquare = createToken({ name: "LSquare", pattern: /\[/ });
const RSquare = createToken({ name: "RSquare", pattern: /]/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const Asterisk = createToken({ name: "Asterisk", pattern: /\*/ });
const DoubleQuote = createToken({ name: "DoubleQuote", pattern: /"/ });
const Quote = createToken({ name: "Quote", pattern: /'/ });
const Percent = createToken({ name: "Percent", pattern: /%/ });
const PlusSign = createToken({ name: "PlusSign", pattern: /\+/ });
const MinusSign = createToken({ name: "MinusSign", pattern: /-/ });
const Solidus = createToken({ name: "Solidus", pattern: /\// });
const Column = createToken({ name: "Column", pattern: /:/ });
const SemiColumn = createToken({ name: "SemiColumn", pattern: /;/ });

const Operator = createToken({
  name: "Operator",
  pattern: /(!=|<>|==|<=|>=|!<|!>|\|\||::|->>|->|~~\*|~~|!~~\*|!~~|~\*|!~\*|!~|>|<)/
});

const Integer = createToken({ name: "Integer", pattern: /0|[1-9]\d*/ });

const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED
});

// note we are placing WhiteSpace first as it is very common thus it will speed up the lexer.
const allTokens = [
  WhiteSpace,

  // "keywords" appear before the Identifier
  Select,
  From,
  Where,
  Values,
  And,
  Or,
  IsNotNull,
  IsNull,

  FunctionIdentifier,

  // The Identifier must appear after the keywords because all keywords are valid identifiers.
  Identifier,
  Integer,

  DoubleQuote,
  Quote,
  Percent,
  PlusSign,
  MinusSign,
  Solidus,
  Column,
  SemiColumn,
  LSquare,
  RSquare,
  LParen,
  RParen,
  Asterisk,
  Comma,
  Period,
  Operator
];

// reuse the same lexer instance
export const SqlLexer = new Lexer(allTokens);

class SqlParser extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  /**
   * statement:
   *    query
   */
  public statement = this.RULE("statement", () => {
    this.OR([{ ALT: () => this.SUBRULE(this.query) }]);
  });

  /**
   * query:
   *      values
   *  |   WITH withItem [ , withItem ]* query
   *  |   {
   *          select
   *      |   selectWithoutFrom
   *      |   query UNION [ ALL | DISTINCT ] query
   *      |   query EXCEPT [ ALL | DISTINCT ] query
   *      |   query MINUS [ ALL | DISTINCT ] query
   *      |   query INTERSECT [ ALL | DISTINCT ] query
   *      }
   *      [ ORDER BY orderItem [, orderItem ]* ]
   *      [ LIMIT [ start, ] { count | ALL } ]
   *      [ OFFSET start { ROW | ROWS } ]
   *      [ FETCH { FIRST | NEXT } [ count ] { ROW | ROWS } ONLY ]
   */
  public query = this.RULE("query", () => {
    this.OR([{ ALT: () => this.SUBRULE(this.values) }]);
  });

  /**
   * expression:
   *      valueExpression
   *  |   null
   */
  public expression = this.RULE("expression", () => {});

  /**
   * <value expression> ::=
   *		<numeric value expression>
   *	|	<string value expression>
   *	|	<datetime value expression>
   *	|	<interval value expression>
   *	|	<boolean value expression>
   *	|	<user-defined type value expression>
   *	|	<row value expression>
   *	|	<reference value expression>
   *	|	<collection value expression>
   *
   * https://github.com/ronsavage/SQL/blob/master/sql-2003-2.bnf
   */
  public valueExpression = this.RULE("valueExpression", () => {});

  /**
   * orderItem:
   *     expression [ ASC | DESC ] [ NULLS FIRST | NULLS LAST ]
   */
  public orderItem = this.RULE("orderItem", () => {});

  /**
   * select:
   *      SELECT [ STREAM ] [ ALL | DISTINCT ]
   *          { * | projectItem [, projectItem ]* }
   *      FROM tableExpression
   *      [ WHERE booleanExpression ]
   *      [ GROUP BY { groupItem [, groupItem ]* } ]
   *      [ HAVING booleanExpression ]
   *      [ WINDOW windowName AS windowSpec [, windowName AS windowSpec ]* ]
   */
  public select = this.RULE("select", () => {});

  /**
   * selectWithoutFrom:
   *      SELECT [ ALL | DISTINCT ]
   *          { * | projectItem [, projectItem ]* }
   */
  public selectWithoutFrom = this.RULE("selectWithoutFrom", () => {});

  /**
   * projectItem:
   *      expression [ [ AS ] columnAlias ]
   *  |   tableAlias . *
   */
  public projectItem = this.RULE("projectItem", () => {});

  /**
   * tableExpression:
   *      tableReference [, tableReference ]*
   *  |   tableExpression [ NATURAL ] [ ( LEFT | RIGHT | FULL ) [ OUTER ] ] JOIN tableExpression [ joinCondition ]
   *  |   tableExpression CROSS JOIN tableExpression
   *  |   tableExpression [ CROSS | OUTER ] APPLY tableExpression
   */
  public tableExpression = this.RULE("tableExpression", () => {});

  /**
   * joinCondition:
   *      ON booleanExpression
   *  |   USING '(' column [, column ]* ')'
   */
  public joinCondition = this.RULE("joinCondition", () => {});

  /**
   * tableReference:
   *      tablePrimary
   *      [ FOR SYSTEM_TIME AS OF expression ]
   *      [ matchRecognize ]
   *      [ [ AS ] alias [ '(' columnAlias [, columnAlias ]* ')' ] ]
   *
   */
  public tableReference = this.RULE("tableReference", () => {});

  /**
   * tablePrimary:
   *      [ [ catalogName . ] schemaName . ] tableName
   *      '(' TABLE [ [ catalogName . ] schemaName . ] tableName ')'
   *  |   tablePrimary [ EXTEND ] '(' columnDecl [, columnDecl ]* ')'
   *  |   [ LATERAL ] '(' query ')'
   *  |   UNNEST '(' expression ')' [ WITH ORDINALITY ]
   *  |   [ LATERAL ] TABLE '(' [ SPECIFIC ] functionName '(' expression [, expression ]* ')' ')'
   */
  public tablePrimary = this.RULE("tablePrimary", () => {});

  /**
   * columnDecl:
   *      column type [ NOT NULL ]
   */
  public columnDecl = this.RULE("columnDecl", () => {});

  /**
   * values:
   *      VALUES expression [, expression ]*
   */
  public values = this.RULE("values", () => {
    this.CONSUME(Values);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => this.OR([{ ALT: () => this.CONSUME(Integer) }])
    });
  });

  /**
   * groupItem:
   *      expression
   *  |   '(' ')'
   *  |   '(' expression [, expression ]* ')'
   *  |   CUBE '(' expression [, expression ]* ')'
   *  |   ROLLUP '(' expression [, expression ]* ')'
   *  |   GROUPING SETS '(' groupItem [, groupItem ]* ')'
   */
  public groupItem = this.RULE("groupItem", () => {});

  /**
   * window:
   *      windowName
   *  |   windowSpec
   */
  public window = this.RULE("window", () => {});

  /**
   * windowSpec:
   *      '('
   *      [ windowName ]
   *      [ ORDER BY orderItem [, orderItem ]* ]
   *      [ PARTITION BY expression [, expression ]* ]
   *      [
   *          RANGE numericOrIntervalExpression { PRECEDING | FOLLOWING }
   *      |   ROWS numericExpression { PRECEDING | FOLLOWING }
   *      ]
   *      ')'
   */
  public windowSpec = this.RULE("windowSpec", () => {});
}

// reuse the same parser instance.
export const parser = new SqlParser();

export function parseSql(statement: string) {
  const lexResult = SqlLexer.tokenize(statement);

  // setting a new input will RESET the parser instance's state.
  parser.input = lexResult.tokens;

  // ref: https://sap.github.io/chevrotain/docs/guide/concrete_syntax_tree.html#ast-vs-cst
  // `statement` is our top level rule as entry point
  const cst = parser.statement();

  return {
    cst,
    lexErrors: lexResult.errors,
    parseErrors: parser.errors
  };
}
