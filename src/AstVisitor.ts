// Resources / Examples
// https://github.com/SAP/chevrotain/issues/747
// https://github.com/RokuRoad/bright/blob/master/src/main.ts

import { parser } from "./SqlParser";
import { SelectContext } from "./Context";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

export class AstVisitor extends Visitor {
  public hasFrom = false;

  constructor() {
    super();

    // The "validateVisitor" method is a helper utility which performs static analysis
    // to detect missing or redundant visitor methods
    this.validateVisitor();
  }

  select(ctx: SelectContext) {
    if (ctx.From) {
      this.hasFrom = true;
    }
  }
}
