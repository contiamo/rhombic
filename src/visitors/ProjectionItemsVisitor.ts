import { parser } from "../SqlParser";
import {
  ProjectionItemContext,
  ProjectionItemsContext,
  CastContext
} from "../Context";
import { IToken, CstElement } from "chevrotain";
import { getImageFromChildren } from "../utils/getImageFromChildren";
import { isCstNode } from "../utils/isCstNode";
import { getChildrenRange } from "../utils/getChildrenRange";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

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
      value: getImageFromChildren(ctx.expression[0].children as any),
      type: getImageFromChildren(ctx.type[0].children as any)
    };
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
            value: getImageFromChildren(i.children.expression[0]
              .children as any)
          };
        }

        Object.values(i.children).forEach(j => {
          j.map((token: CstElement) => {
            if (isCstNode(token)) {
              // Extract `cast` information
              if (token.name === "cast") {
                cast = this.cast(token.children as any);
              }
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
      ...getChildrenRange(ctx as any),
      isAsterisk,
      alias,
      cast,
      fn,
      expression
    });
  }
}
