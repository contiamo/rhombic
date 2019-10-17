import { parser } from "../SqlParser";
import { BooleanExpressionContext, TableExpressionContext } from "../Context";
import { getChildrenRange } from "../utils/getChildrenRange";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

interface Location {
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

/**
 * Visitor to extract information about `WHERE` statement
 */
export class WhereVisitor extends Visitor {
  public location?: Location;
  public booleanExpressionNode?: BooleanExpressionContext;

  constructor() {
    super();
    this.validateVisitor();
  }

  tableExpression(ctx: TableExpressionContext) {
    // Register end of tableExpression as location as fallback
    const tableRange = getChildrenRange(ctx);
    this.location = {
      startLine: tableRange.endLine,
      startColumn: tableRange.endColumn + 1,
      endColumn: tableRange.endColumn + 1,
      endLine: tableRange.endLine
    };
  }

  booleanExpression(ctx: BooleanExpressionContext) {
    this.location = getChildrenRange(ctx);
    this.booleanExpressionNode = ctx;
  }
}
