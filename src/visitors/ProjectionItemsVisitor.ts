import { parser } from "../SqlParser";
import { ProjectionItemContext } from "../Context";
import { IToken } from "chevrotain";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

/**
 * Visitor to extract `projectionItem` list
 */
export class ProjectionItemsVisitor extends Visitor {
  public output: IToken[] = [];

  constructor() {
    super();
    this.validateVisitor();
  }

  projectionItem(ctx: ProjectionItemContext) {
    if (ctx.expression) {
      ctx.expression.forEach(i => {
        Object.values(i.children).forEach(j => this.output.push(...j));
      });
    }

    if (ctx.Asterisk) {
      this.output.push(...ctx.Asterisk);
    }

    if (ctx.Identifier) {
      this.output.push(...ctx.Identifier);
    }
  }
}
