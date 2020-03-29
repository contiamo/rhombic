import { parser } from "../SqlParser";
import { TablePrimaryContext } from "../Context";
import { TablePrimary } from "..";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

/**
 * Visitor to check if a tableReference is part of the query
 */
export class TablePrimaryVisitor extends Visitor {
  public hasTablePrimary = false;
  public tables: TablePrimary[] = [];

  private name: string;

  constructor(name: string = "") {
    super();
    this.validateVisitor();
    this.name = name
      .split(".")
      .map(sanitizeTableName)
      .join(".");
  }

  protected tablePrimary(ctx: TablePrimaryContext) {
    if (ctx.Identifier) {
      const tableName = ctx.Identifier.map(i => sanitizeTableName(i.image));

      if (tableName.length === 3) {
        this.tables.push({
          catalogName: tableName[0],
          schemaName: tableName[1],
          tableName: tableName[2]
        });
      }

      if (tableName.length === 2) {
        this.tables.push({
          schemaName: tableName[0],
          tableName: tableName[1]
        });
      }

      if (tableName.length === 1) {
        this.tables.push({
          tableName: tableName[0]
        });
      }

      if (this.name === tableName.join(".")) {
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
