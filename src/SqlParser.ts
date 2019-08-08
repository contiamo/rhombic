import { createToken, Lexer, CstParser } from "chevrotain";
import { matchFunctionName } from "./utils/matchFunctionName";

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

const All = createToken({
  name: "All",
  pattern: /ALL/i,
  longer_alt: Identifier
});

const Distinct = createToken({
  name: "Distinct",
  pattern: /DISTINCT/i,
  longer_alt: Identifier
});

const Stream = createToken({
  name: "Stream",
  pattern: /STREAM/i,
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

const As = createToken({
  name: "As",
  pattern: /AS/i,
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
const Null = createToken({ name: "Null", pattern: /null/ });
const Asterisk = createToken({ name: "Asterisk", pattern: /\*/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Period = createToken({ name: "Period", pattern: /\./ });
const LSquare = createToken({ name: "LSquare", pattern: /\[/ });
const RSquare = createToken({ name: "RSquare", pattern: /]/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const Column = createToken({ name: "Column", pattern: /:/ });
const SemiColumn = createToken({ name: "SemiColumn", pattern: /;/ });

const Operator = createToken({
  name: "Operator",
  pattern: /(!=|<>|==|<=|>=|!<|!>|\|\||::|->>|->|~~\*|~~|!~~\*|!~~|~\*|!~\*|!~|>|<|\+|-|\/|%)/
});

const Integer = createToken({ name: "Integer", pattern: /0|[1-9]\d*/ });
const String = createToken({
  name: "String",
  pattern: /((`[^`]*(`))+)|((\[[^\]]*(\]))(\][^\]]*(\]))*)|(("[^"\\]*(?:\\.[^"\\]*)*("))+)|(('[^'\\]*(?:\\.[^'\\]*)*('))+)|((N'[^N'\\]*(?:\\.[^N'\\]*)*('))+)/
});

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
  Null,
  As,
  Distinct,
  All,
  Stream,

  FunctionIdentifier,

  // The Identifier must appear after the keywords because all keywords are valid identifiers.
  Identifier,
  Integer,
  String,

  Asterisk,
  Column,
  SemiColumn,
  LSquare,
  RSquare,
  LParen,
  RParen,
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
    this.OR([
      { ALT: () => this.SUBRULE(this.values) },
      { ALT: () => this.SUBRULE(this.select) }
    ]);
  });

  /**
   * expression:
   *      valueExpression
   *  |   null
   */
  public expression = this.RULE("expression", () => {
    this.OR([
      { ALT: () => this.CONSUME(Integer) },
      { ALT: () => this.CONSUME(String) },
      { ALT: () => this.CONSUME(Null) },
      {
        ALT: () => {
          this.CONSUME(LParen);
          this.MANY_SEP({
            SEP: Comma,
            DEF: () => this.SUBRULE(this.expression)
          });
          this.CONSUME(RParen);
        }
      },
      { ALT: () => this.CONSUME(Identifier) }
    ]);
  });

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
   *          { projectItem [, projectItem ]* }
   *      FROM tableExpression
   *      [ WHERE booleanExpression ]
   *      [ GROUP BY { groupItem [, groupItem ]* } ]
   *      [ HAVING booleanExpression ]
   *      [ WINDOW windowName AS windowSpec [, windowName AS windowSpec ]* ]
   *
   *
   */
  public select = this.RULE("select", () => {
    this.CONSUME(Select);
    this.OPTION(() => this.CONSUME(Stream));
    this.OPTION1(() => {
      this.OR([
        { ALT: () => this.CONSUME(All) },
        { ALT: () => this.CONSUME(Distinct) }
      ]);
    });
    this.SUBRULE(this.projectItems);

    // Everything is wrap into `OPTION` to deal with selectWithoutFrom case
    this.OPTION3(() => {
      this.CONSUME(From);
      this.SUBRULE(this.tableExpression);
    });
  });

  /**
   * projectItems:
   *     projectItem [, projectItem ]*
   */
  public projectItems = this.RULE("projectItems", () => {
    this.SUBRULE(this.projectItem);
    this.OPTION(() => {
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE1(this.projectItem);
      });
    });
  });

  /**
   * projectItem:
   *      expression [ [ AS ] columnAlias ]
   *  |   tableAlias . *
   *  |   *
   */
  public projectItem = this.RULE("projectItem", () => {
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.expression);
          this.OPTION(() => {
            this.CONSUME(As);
            this.CONSUME(Identifier);
          });
        }
      },
      { ALT: () => this.CONSUME(Asterisk) }
      // {
      //   ALT: () => {
      //     this.CONSUME1(Identifier);
      //     this.CONSUME(Period);
      //     this.CONSUME(Asterisk);
      //   }
      // }
    ]);
  });

  /**
   * tableExpression:
   *      tableReference [, tableReference ]*
   *  |   tableExpression [ NATURAL ] [ ( LEFT | RIGHT | FULL ) [ OUTER ] ] JOIN tableExpression [ joinCondition ]
   *  |   tableExpression CROSS JOIN tableExpression
   *  |   tableExpression [ CROSS | OUTER ] APPLY tableExpression
   */
  public tableExpression = this.RULE("tableExpression", () => {
    this.OR([
      {
        ALT: () => {
          this.MANY_SEP({
            SEP: Comma,
            DEF: () => this.SUBRULE(this.tableReference)
          });
        }
      }
    ]);
  });

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
  public tableReference = this.RULE("tableReference", () => {
    this.SUBRULE(this.tablePrimary);
  });

  /**
   * tablePrimary:
   *      [ [ catalogName . ] schemaName . ] tableName
   *      '(' TABLE [ [ catalogName . ] schemaName . ] tableName ')'
   *  |   tablePrimary [ EXTEND ] '(' columnDecl [, columnDecl ]* ')'
   *  |   [ LATERAL ] '(' query ')'
   *  |   UNNEST '(' expression ')' [ WITH ORDINALITY ]
   *  |   [ LATERAL ] TABLE '(' [ SPECIFIC ] functionName '(' expression [, expression ]* ')' ')'
   */
  public tablePrimary = this.RULE("tablePrimary", () => {
    this.OR([
      {
        ALT: () => {
          // CatalogName
          this.OPTION(() => {
            this.CONSUME1(Identifier);
            this.CONSUME(Period);
          });
          // schemaName
          this.OPTION1(() => {
            this.CONSUME3(Identifier);
            this.CONSUME2(Period);
          });
          this.CONSUME4(Identifier);
        }
      }
    ]);
  });

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
      DEF: () => this.SUBRULE(this.expression)
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
