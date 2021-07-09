import { ParserRuleContext } from "antlr4ts";
import { Lineage } from "../Lineage";
import { Range } from "../utils/getRange";
import { Clause, LineageContext, Relation } from "./LineageContext";
import { SqlBaseListener } from "./SqlBaseListener";
import {
  AliasedQueryContext,
  FromClauseContext,
  NamedExpressionContext,
  QueryContext,
  TableNameContext
} from "./SqlBaseParser";

export class LineageListener<
  TableData extends { id: string },
  ColumnData extends { id: string }
> implements SqlBaseListener {
  getters: {
    getTable: (tableId: string) => TableData;
    getColumns: (tableId: string) => ColumnData[];
  };

  relationSeq: number = 0;
  relationsStack: Array<Relation<TableData, ColumnData>> = new Array();
  lineage: Lineage<TableData, ColumnData> = new Array();

  // setting up phony lineage context, each query will open it's own
  lineageContext: LineageContext<TableData, ColumnData> = new LineageContext(
    undefined
  );

  constructor(getters: {
    getTable: (tableId: string) => TableData;
    getColumns: (tableId: string) => ColumnData[];
  }) {
    this.getters = getters;
  }

  private nextRelationId(): string {
    this.relationSeq++;
    return "result_" + this.relationSeq;
  }

  enterQuery(ctx: QueryContext): void {
    this.lineageContext = new LineageContext(this.lineageContext);
    console.log("Query entered: " + ctx.text);
  }

  exitQuery(ctx: QueryContext): void {
    this.lineage = this.lineage.concat(
      this.lineageContext.getRelationsLineage()
    );
    // to be consumed later
    this.relationsStack.push(
      this.lineageContext.toRelation(
        this.nextRelationId(),
        this.rangeFromContext(ctx)
      )
    );
    this.lineageContext = this.lineageContext.parent!;
    console.log("Query exited: " + ctx.text);
    // result of the query is relation
    // need to build relation and pass it somehow to the parent
  }

  // enterFromClause(ctx: FromClauseContext): void {
  //   console.log("From entered: " + ctx.text);
  //   this.lineageContext.currentClause = Clause.From;
  // }

  // exitFromClause(ctx: FromClauseContext): void {
  //   this.lineageContext.currentClause = Clause.Other;
  // }

  exitTableName(ctx: TableNameContext): void {
    let tableName = ctx.multipartIdentifier().text;
    let columns = this.getters.getColumns(tableName).map(c => ({
      id: c.id,
      label: c.id,
      data: c
    }));

    this.lineageContext.relations.set(
      ctx.tableAlias().strictIdentifier()?.text ?? tableName,
      new Relation(tableName, columns, this.rangeFromContext(ctx))
    );
  }

  exitAliasedQuery(ctx: AliasedQueryContext): void {
    // expecting query relation to be in stack
    let relation = this.relationsStack.pop()!;
    this.lineageContext.relations.set(
      ctx.tableAlias().strictIdentifier()?.text ?? relation.id,
      relation
    );
  }

  // TODO process subqueries
  /*
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  */

  rangeFromContext(ctx: ParserRuleContext): Range {
    let stop = ctx.stop ?? ctx.start;
    return {
      startLine: ctx.start.line,
      endLine: stop.line,
      startColumn: ctx.start.charPositionInLine,
      endColumn:
        stop.charPositionInLine + (stop.stopIndex - stop.startIndex + 1)
    };
  }

  exitNamedExpression(ctx: NamedExpressionContext): void {
    let columnId =
      ctx.errorCapturingIdentifier()?.identifier()?.text ??
      this.lineageContext.getNextColumnId();
    let range = this.rangeFromContext(ctx);
    let column = {
      id: columnId,
      label: columnId,
      range: range
    };
    this.lineageContext.columns.push(column);
  }
}
