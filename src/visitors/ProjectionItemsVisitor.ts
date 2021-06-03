import { parser } from "../SqlParser";
import {
  ProjectionItemContext,
  ProjectionItemsContext,
  CastContext,
  OrderItemContext,
  OrderByContext
} from "../Context";
import { IToken, CstElement } from "chevrotain";
import { getImageFromChildren } from "../utils/getImageFromChildren";
import { getChildrenRange } from "../utils/getChildrenRange";
import { isCstNode } from "../utils/isCstNode";
import {
  isAsteriskContext,
  isExpressionContext
} from "../utils/projectionItem";
import { isFunctionContext } from "../utils/expression";
import { Range } from "../utils/getRange";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

function isCastNode(
  node: any
): node is {
  name: "cast";
  children: CastContext;
} {
  return isCstNode(node) && node.name === "cast";
}

/**
 * Visitor to extract `projectionItem` list
 */
export class ProjectionItemsVisitor extends Visitor {
  public output: Array<{
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    isAsterisk: boolean;
    expression: string;
    alias?: string;
    cast?: {
      value: string;
      type: string;
    };
    fn?: { identifier: string; value: string };
    sort?: {
      order: "asc" | "desc";
      nullsOrder?: "first" | "last";
    };
  }> = [];

  public sort: Array<{
    expression: string;
    expressionRange: Range;
    order?: "asc" | "desc";
    nullsOrder?: "first" | "last";
  }> = [];

  public sortRange: Range | undefined;

  public commas: IToken[] = [];

  public asteriskCount = 0;

  constructor() {
    super();
    this.validateVisitor();
  }

  projectionItems(ctx: ProjectionItemsContext) {
    if (ctx.Comma) {
      this.commas.push(...ctx.Comma);
    }
    if (ctx.projectionItem) {
      ctx.projectionItem.map(i => this.projectionItem(i.children));
    }
  }

  cast(ctx: CastContext) {
    return {
      value: getImageFromChildren(ctx.expression[0].children),
      type: getImageFromChildren(ctx.type[0].children)
    };
  }

  orderBy(ctx: OrderByContext) {
    this.sortRange = getChildrenRange(ctx);
    ctx.orderItem.forEach(i => this.orderItem(i.children));
  }

  orderItem(ctx: OrderItemContext) {
    const expression = getImageFromChildren(ctx.expression[0].children);
    const expressionRange = getChildrenRange(ctx.expression[0].children);
    const sort: {
      order?: "asc" | "desc";
      nullsOrder?: "first" | "last";
    } = {};

    if (ctx.Desc) sort.order = "desc";
    if (ctx.Asc) sort.order = "asc";
    if (ctx.First) sort.nullsOrder = "first";
    if (ctx.Last) sort.nullsOrder = "last";

    this.output = this.output.map(i =>
      i.expression === expression || i.alias === expression
        ? {
            ...i,
            sort: {
              ...sort,
              order: sort.order || "asc"
            }
          }
        : i
    );
    this.sort.push({ expression, expressionRange, ...sort });
  }

  projectionItem(ctx: ProjectionItemContext) {
    let isAsterisk = false;
    let cast: { value: string; type: string } | undefined;
    let fn: { identifier: string; value: string } | undefined;
    let expression = "";
    let alias: string | undefined;

    if (isExpressionContext(ctx)) {
      ctx.expression.forEach(i => {
        // Extract `fn` information
        if (isFunctionContext(i.children)) {
          fn = {
            identifier: i.children.FunctionIdentifier[0].image,
            value: getImageFromChildren(i.children.expression[0].children)
          };
        }

        Object.values(i.children).forEach(j => {
          j.map((token: CstElement) => {
            if (isCastNode(token)) {
              // Extract `cast` information
              cast = this.cast(token.children);
            }
          });
        });
      });

      // Extract `expression`
      expression = getImageFromChildren(
        ctx.expression.reduce((mem, i) => ({ mem, ...i.children }), {})
      );
    }

    if (isAsteriskContext(ctx)) {
      this.asteriskCount++;
      isAsterisk = true;
    }

    if (isExpressionContext(ctx) && ctx.As && ctx.Identifier) {
      alias = ctx.Identifier[ctx.Identifier.length - 1].image;
    }

    this.output.push({
      ...getChildrenRange(ctx),
      isAsterisk,
      alias,
      cast,
      fn,
      expression
    });
  }
}
