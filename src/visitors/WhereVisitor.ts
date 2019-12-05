import { parser } from "../SqlParser";
import {
  BooleanExpressionContext,
  TableExpressionContext,
  WhereContext
} from "../Context";
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
  public tableLocation?: Location;
  public booleanExpressionLocation?: Location;
  public whereLocation?: Location;

  public booleanExpressionNode?: BooleanExpressionContext;

  constructor() {
    super();
    this.validateVisitor();
  }

  tableExpression(ctx: TableExpressionContext) {
    // Register end of tableExpression as location as fallback
    const tableRange = getChildrenRange(ctx);
    this.tableLocation = {
      startLine: tableRange.endLine,
      startColumn: tableRange.endColumn + 1,
      endColumn: tableRange.endColumn + 1,
      endLine: tableRange.endLine
    };
  }

  booleanExpression(ctx: BooleanExpressionContext) {
    this.booleanExpressionLocation = getChildrenRange(ctx);
    this.booleanExpressionNode = ctx;
  }

  where(ctx: WhereContext) {
    this.whereLocation = getChildrenRange(ctx);
    ctx.booleanExpression.map(i => this.booleanExpression(i.children));
  }
}
