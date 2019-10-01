import { parser } from "../SqlParser";
import { ProjectionItemContext } from "../Context";
import { IToken } from "chevrotain";

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
    children: IToken[];
  }> = [];

  public hasAsterisk = false;

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
    }

    if (ctx.Asterisk) {
      ctx.Asterisk.map(token => {
        startLine = Math.min(startLine, token.startLine || Infinity);
        endLine = Math.max(endLine, token.endLine || -Infinity);
        startColumn = Math.min(startColumn, token.startColumn || Infinity);
        endColumn = Math.max(endColumn, token.endColumn || -Infinity);
      });
      children.push(...ctx.Asterisk);
      this.hasAsterisk = true;
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

    this.output.push({
      startLine,
      endLine,
      startColumn,
      endColumn,
      isAsterisk,
      children
    });
  }
}
