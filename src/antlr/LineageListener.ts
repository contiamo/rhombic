import { ParserRuleContext } from "antlr4ts";
import { Lineage } from "../Lineage";
import { Range } from "../utils/getRange";
import { Clause, LineageContext, Relation } from "./LineageContext";
import { SqlBaseListener } from "./SqlBaseListener";
import {
  AliasedQueryContext,
  ColumnReferenceContext,
  DereferenceContext,
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

  lineageContext?: LineageContext<TableData, ColumnData>;

  // valid only after initialization
  get ctx(): LineageContext<TableData, ColumnData> {
    return this.lineageContext!;
  }

  constructor(getters: {
    getTable: (tableId: string) => TableData;
    getColumns: (tableId: string) => ColumnData[];
  }) {
    this.getters = getters;
  }

  private get nextRelationId(): string {
    this.relationSeq++;
    return "result_" + this.relationSeq;
  }

  enterQuery(ctx: QueryContext): void {
    this.lineageContext = new LineageContext(this.lineageContext);
    console.log("Query entered: " + ctx.text);
  }

  exitQuery(ctx: QueryContext): void {
    this.lineage = this.lineage.concat(this.ctx.getRelationsLineage());

    // to be consumed later
    this.relationsStack.push(
      this.ctx.toRelation(this.nextRelationId, this.rangeFromContext(ctx))
    );

    this.lineageContext = this.ctx.parent;
    console.log("Query exited: " + ctx.text);
  }

  // enterFromClause(ctx: FromClauseContext): void {
  //   console.log("From entered: " + ctx.text);
  //   this.lineageContext.currentClause = Clause.From;
  // }

  // exitFromClause(ctx: FromClauseContext): void {
  //   this.lineageContext.currentClause = Clause.Other;
  // }

  enterDereference(ctx: DereferenceContext): void {
    if (!this.ctx.resolvedDereference) {
      let primary = ctx.primaryExpression();
      if (primary instanceof ColumnReferenceContext) {
        let tableName = primary.identifier().text;
        let colName = ctx.identifier().text;
        let col = this.ctx.resolveColumn(colName, tableName);
        if (col) {
          this.ctx.resolvedDereference = ctx;
          this.ctx.columnReferences.push(col);
        }
      }
    }
    // try to resolve reference
    // if resolved - set dereference is resolved with this ctx
    // add resolved id to the list
  }

  exitDereference(ctx: DereferenceContext): void {
    // if saved dereference context is this one then unset saved dereference
  }

  exitColumnReference(ctx: ColumnReferenceContext): void {
    // if !resolved - try to resolve column
  }

  exitTableName(ctx: TableNameContext): void {
    let tableName = ctx.multipartIdentifier().text;
    let tableData = this.getters.getTable(tableName);
    let columns = this.getters.getColumns(tableName).map(c => ({
      id: c.id,
      label: c.id,
      data: c
    }));
    let alias = ctx.tableAlias().strictIdentifier()?.text ?? tableName;
    this.ctx.relations.set(
      alias,
      new Relation(
        this.nextRelationId,
        columns,
        this.ctx.level + 1,
        this.rangeFromContext(ctx),
        tableData,
        tableName
      )
    );
  }

  exitAliasedQuery(ctx: AliasedQueryContext): void {
    // expecting query relation to be in stack
    let relation = this.relationsStack.pop()!;
    this.ctx.relations.set(
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

  enterNamedExpression(ctx: NamedExpressionContext): void {
    // clear array to start accumulating new references
    this.ctx.columnReferences.length = 0;
  }

  exitNamedExpression(ctx: NamedExpressionContext): void {
    let columnId =
      ctx.errorCapturingIdentifier()?.identifier()?.text ??
      this.ctx.nextColumnId;
    let range = this.rangeFromContext(ctx);
    let column = {
      id: columnId,
      label: columnId,
      range: range
    };
    this.ctx.columns.push(column);
    for (let c of this.ctx.columnReferences) {
      this.lineage.push({
        type: "edge",
        source: c,
        target: {
          tableId: "table_1", // TODO this.ctx.id
          columnId: columnId
        }
      });
    }
  }
}
