import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { TablePrimary } from "..";
import { SqlBaseVisitor } from "./SqlBaseVisitor";
import common from "./common";
import { TableNameContext } from "./SqlBaseParser";
import { CursorQuery } from "./Cursor";

export class ExtractTablesVisitor extends AbstractParseTreeVisitor<TablePrimary[]>
  implements SqlBaseVisitor<TablePrimary[]> {
  constructor(readonly cursor: CursorQuery) {
    super();
  }

  protected defaultResult(): TablePrimary[] {
    return [];
  }

  aggregateResult(aggregate: TablePrimary[], nextResult: TablePrimary[]): TablePrimary[] {
    return aggregate.concat(nextResult);
  }

  visitTableName(ctx: TableNameContext): TablePrimary[] {
    const multipartTableName = ctx
      .multipartIdentifier()
      .errorCapturingIdentifier()
      .map(v => this.cursor.removeFrom(common.stripQuote(v.identifier()).name));
    return multipartTableName.length > 0 ? [common.tablePrimaryFromMultipart(multipartTableName)] : [];
  }
}
