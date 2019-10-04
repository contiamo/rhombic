import { parser } from "../SqlParser";
import { ProjectionItemContext } from "../Context";
import { IToken } from "chevrotain";
import { getImageFromChildren } from "../utils/getImageFromChildren";

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
    children: IToken[];
  }> = [];

  public asteriskCount = 0;

  constructor() {
    super();
    this.validateVisitor();
  }

  projectionItem(ctx: ProjectionItemContext) {
    let startLine = Infinity;
    let endLine = -Infinity;
    let startColumn = Infinity;
    let endColumn = -Infinity;
    let isAsterisk = false;
    let expression = "";
    let alias: string | undefined;
    const children: IToken[] = [];

    if (ctx.expression) {
      ctx.expression.forEach(i => {
        Object.values(i.children).forEach(j => {
          j.map((token: IToken) => {
            startLine = Math.min(startLine, token.startLine || Infinity);
            endLine = Math.max(endLine, token.endLine || -Infinity);
            startColumn = Math.min(startColumn, token.startColumn || Infinity);
            endColumn = Math.max(endColumn, token.endColumn || -Infinity);
          });
          children.push(...j);
        });
      });
      expression = getImageFromChildren(
        ctx.expression.reduce((mem, i) => ({ mem, ...i.children }), {})
      );
    }

    if (ctx.Asterisk) {
      ctx.Asterisk.map(token => {
        startLine = Math.min(startLine, token.startLine || Infinity);
        endLine = Math.max(endLine, token.endLine || -Infinity);
        startColumn = Math.min(startColumn, token.startColumn || Infinity);
        endColumn = Math.max(endColumn, token.endColumn || -Infinity);
      });
      children.push(...ctx.Asterisk);
      this.asteriskCount++;
      isAsterisk = true;
    }

    if (ctx.Identifier) {
      ctx.Identifier.map(token => {
        startLine = Math.min(startLine, token.startLine || Infinity);
        endLine = Math.max(endLine, token.endLine || -Infinity);
        startColumn = Math.min(startColumn, token.startColumn || Infinity);
        endColumn = Math.max(endColumn, token.endColumn || -Infinity);
      });
      children.push(...ctx.Identifier);
    }

    if (ctx.As && ctx.Identifier) {
      alias = ctx.Identifier[ctx.Identifier.length - 1].image;
    }

    this.output.push({
      startLine,
      endLine,
      startColumn,
      endColumn,
      isAsterisk,
      children,
      alias,
      expression
    });
  }
}
