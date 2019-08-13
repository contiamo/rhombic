import { parser } from "../SqlParser";
import { TablePrimaryContext } from "../Context";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

/**
 * Visitor to check if a tableReference is part of the query
 */
export class HasTablePrimary extends Visitor {
  public hasTablePrimary = false;

  private name: string;

  constructor(name: string) {
    super();
    this.validateVisitor();
    this.name = name
      .split(".")
      .map(sanitizeTableName)
      .join(".");
  }

  protected tablePrimary(ctx: TablePrimaryContext) {
    if (ctx.Identifier) {
      const tableName = ctx.Identifier.map(i =>
        sanitizeTableName(i.image)
      ).join(".");

      if (this.name === tableName) {
        this.hasTablePrimary = true;
      }
    }
  }
}

/**
 * Deal with quotes.
 *
 * @param raw chunk of table name
 */
const sanitizeTableName = (raw: string) => {
  if (raw[0] === '"' && raw[raw.length - 1] === '"') {
    return raw.slice(1, -1);
  }

  return raw;
};
