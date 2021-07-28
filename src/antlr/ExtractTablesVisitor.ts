import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { TablePrimary } from "..";
import { SqlBaseVisitor } from "./SqlBaseVisitor";
import common from "./common";
import { TableNameContext } from "./SqlBaseParser";

export class ExtractTablesVisitor extends AbstractParseTreeVisitor<TablePrimary[]>
  implements SqlBaseVisitor<TablePrimary[]> {
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
      .map(v => common.stripQuote(v.identifier()).name);
    return [common.tablePrimaryFromMultipart(multipartTableName)];
  }
}
