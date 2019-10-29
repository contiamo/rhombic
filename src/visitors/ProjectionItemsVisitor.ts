import { parser } from "../SqlParser";
import {
  ProjectionItemContext,
  ProjectionItemsContext,
  CastContext,
  OrderItemContext
} from "../Context";
import { IToken, CstElement } from "chevrotain";
import { getImageFromChildren } from "../utils/getImageFromChildren";
import { isCstNode } from "../utils/isCstNode";
import { getChildrenRange } from "../utils/getChildrenRange";

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
    order: "asc" | "desc";
    nullsOrder?: "first" | "last";
  }> = [];

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

  orderItem(ctx: OrderItemContext) {
    const expression = getImageFromChildren(ctx.expression[0].children);
    const sort: {
      order: "asc" | "desc";
      nullsOrder?: "first" | "last";
    } = {
      order: "asc"
    };

    if (ctx.Desc) sort.order = "desc";
    if (ctx.First) sort.nullsOrder = "first";
    if (ctx.Last) sort.nullsOrder = "last";

    this.output = this.output.map(i =>
      i.expression === expression ? { ...i, sort } : i
    );
    this.sort.push({ expression, ...sort });
  }

  projectionItem(ctx: ProjectionItemContext) {
    let isAsterisk = false;
    let cast: { value: string; type: string } | undefined;
    let fn: { identifier: string; value: string } | undefined;
    let expression = "";
    let alias: string | undefined;

    if (ctx.expression) {
      ctx.expression.forEach(i => {
        // Extract `fn` information
        if (i.children.FunctionIdentifier) {
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

    if (ctx.Asterisk) {
      this.asteriskCount++;
      isAsterisk = true;
    }

    if (ctx.As && ctx.Identifier) {
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
