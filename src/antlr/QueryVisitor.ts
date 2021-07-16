import { Column, Lineage, Table } from "../Lineage";
import { SqlBaseVisitor } from "./SqlBaseVisitor";
import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { Range } from "../utils/getRange";
import { ColumnRef, Relation } from "./model";
import { ParserRuleContext } from "antlr4ts";
import {
  AliasedQueryContext,
  ColumnReferenceContext,
  DereferenceContext,
  ExpressionContext,
  FromClauseContext,
  NamedExpressionContext,
  PredicatedContext,
  PrimaryExpressionContext,
  QueryContext,
  QuerySpecificationContext,
  RegularQuerySpecificationContext,
  TableNameContext,
  ValueExpressionDefaultContext
} from "./SqlBaseParser";
import { LineageContext } from "./LineageContext";

export class QueryVisitor<
  TableData extends { id: string },
  ColumnData extends { id: string }
> extends AbstractParseTreeVisitor<Lineage<TableData, ColumnData> | undefined>
  implements SqlBaseVisitor<Lineage<TableData, ColumnData> | undefined> {
  private id;

  private topQuery = true;

  // sequence generator for columns in this context
  private columnIdSeq: number = 0;

  // columns for this query extracted from SELECT
  columns: Array<Column<ColumnData>> = new Array();

  // relations for this context extracted from FROM
  relations: Map<string, Relation<TableData, ColumnData>> = new Map();

  columnReferences: Array<ColumnRef> = new Array();

  globals: LineageContext<TableData, ColumnData>;

  // parent reference, used for name resolution
  readonly parent?: QueryVisitor<TableData, ColumnData>;

  constructor(
    globals: LineageContext<TableData, ColumnData>,
    parent?: QueryVisitor<TableData, ColumnData>
  ) {
    super();
    this.globals = globals;
    this.parent = parent;
    this.id = this.globals.nextRelationId;
  }

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

  get level(): number {
    let level = 0;
    let cur: QueryVisitor<TableData, ColumnData> = this;
    while (cur.parent !== undefined) {
      level++;
      cur = cur.parent;
    }
    return level;
  }

  findRelation(tableName: string): Relation<TableData, ColumnData> | undefined {
    let cur: QueryVisitor<TableData, ColumnData> | undefined = this;
    while (cur != undefined) {
      let table = cur.relations.get(tableName);
      if (table !== undefined) return table;
      cur = cur.parent;
    }
    return undefined;
  }

  resolveColumn(columnName: string, tableName?: string): ColumnRef | undefined {
    if (tableName !== undefined) {
      let table = this.findRelation(tableName);
      let col = table?.columns.find(c => c.label == columnName);
      if (table && col) {
        return { tableId: table.id, columnId: col.id };
      }
    } else {
      for (let r of this.relations) {
        let col = r[1].columns.find(c => c.label == columnName);
        if (col) {
          return { tableId: r[1].id, columnId: col.id };
        }
      }
    }
    return undefined;
  }

  toRelation(range?: Range): Relation<TableData, ColumnData> {
    return new Relation<TableData, ColumnData>(
      this.id,
      this.columns,
      this.level,
      range
    );
  }

  get nextColumnId(): string {
    this.columnIdSeq++;
    return "column_" + this.columnIdSeq;
  }

  protected defaultResult(): Lineage<TableData, ColumnData> | undefined {
    return undefined;
  }

  protected extractTableAndColumn(
    ctx: PrimaryExpressionContext
  ): { table?: string; column: string } | undefined {
    if (ctx instanceof ColumnReferenceContext) {
      return { column: ctx.identifier().text };
    } else if (ctx instanceof DereferenceContext) {
      let primary = ctx.primaryExpression();
      if (primary instanceof ColumnReferenceContext) {
        return {
          table: primary.identifier().text,
          column: ctx.identifier().text
        };
      }
    }
    return undefined;
  }

  protected deriveColumnName(ctx: ExpressionContext): string | undefined {
    let boolExpr = ctx.booleanExpression();
    if (boolExpr instanceof PredicatedContext) {
      let valExpr = boolExpr.valueExpression();
      if (valExpr instanceof ValueExpressionDefaultContext) {
        let tableCol = this.extractTableAndColumn(valExpr.primaryExpression());
        if (tableCol !== undefined) {
          return tableCol.column;
        }
      }
    }
    return undefined;
  }

  aggregateResult(
    aggregate: Lineage<TableData, ColumnData> | undefined,
    nextResult: Lineage<TableData, ColumnData> | undefined
  ): Lineage<TableData, ColumnData> | undefined {
    if (nextResult) {
      return aggregate ? aggregate.concat(nextResult) : nextResult;
    } else {
      return aggregate;
    }
  }

  visitQuery(ctx: QueryContext): Lineage<TableData, ColumnData> | undefined {
    if (this.topQuery) {
      this.topQuery = false;
      let result = this.visitChildren(ctx);

      // to be consumed later
      this.globals.relationsStack.push(
        this.toRelation(this.rangeFromContext(ctx))
      );

      return result;
    } else {
      let visitor = new QueryVisitor(this.globals, this);
      return ctx.accept(visitor);
    }
  }

  visitRegularQuerySpecification(
    ctx: RegularQuerySpecificationContext
  ): Lineage<TableData, ColumnData> | undefined {
    var lineage = ctx.fromClause()?.accept(this);
    ctx.children?.forEach(c => {
      if (!(c instanceof FromClauseContext)) {
        lineage = this.aggregateResult(lineage, c.accept(this));
      }
    });
    return lineage;
  }

  visitTableName(
    ctx: TableNameContext
  ): Lineage<TableData, ColumnData> | undefined {
    let tableName = ctx.multipartIdentifier().text;
    let tableData = this.globals.getters.getTable(tableName);
    let columns = this.globals.getters.getColumns(tableName).map(c => ({
      id: c.id,
      label: c.id,
      data: c
    }));
    let alias = ctx.tableAlias().strictIdentifier()?.text ?? tableName;
    let relation = new Relation(
      this.globals.nextRelationId,
      columns,
      this.level + 1,
      this.rangeFromContext(ctx),
      tableData,
      tableName
    );

    this.relations.set(alias, relation);
    return [relation.toLineage(alias)];
  }

  visitAliasedQuery(
    ctx: AliasedQueryContext
  ): Lineage<TableData, ColumnData> | undefined {
    let lineage = this.visitChildren(ctx);
    // expecting query relation to be in stack
    let relation = this.globals.relationsStack.pop()!;
    let alias = ctx.tableAlias().strictIdentifier()?.text ?? relation.id;
    this.relations.set(alias, relation);
    return this.aggregateResult(lineage, [relation.toLineage(alias)]);
  }

  visitNamedExpression(
    ctx: NamedExpressionContext
  ): Lineage<TableData, ColumnData> | undefined {
    // clear array to start accumulating new references
    this.columnReferences.length = 0;

    let result = this.visitChildren(ctx);

    let columnId = this.nextColumnId;
    let label =
      ctx.errorCapturingIdentifier()?.identifier()?.text ??
      this.deriveColumnName(ctx.expression()) ??
      columnId;

    let range = this.rangeFromContext(ctx);
    let column = {
      id: columnId,
      label: label,
      range: range
    };
    this.columns.push(column);
    let lineage = new Array();
    for (let c of this.columnReferences) {
      lineage.push({
        type: "edge",
        source: c,
        target: {
          tableId: this.id,
          columnId: columnId
        }
      });
    }

    return this.aggregateResult(result, lineage);
  }

  visitColumnReference(
    ctx: ColumnReferenceContext
  ): Lineage<TableData, ColumnData> | undefined {
    return this.visitPrimaryExpression(ctx);
  }

  visitDereference(
    ctx: DereferenceContext
  ): Lineage<TableData, ColumnData> | undefined {
    return this.visitPrimaryExpression(ctx);
  }

  visitPrimaryExpression(
    ctx: PrimaryExpressionContext
  ): Lineage<TableData, ColumnData> | undefined {
    let tableCol = this.extractTableAndColumn(ctx);
    if (tableCol !== undefined) {
      let col = this.resolveColumn(tableCol.column, tableCol.table);
      if (col) {
        this.columnReferences.push(col);
      }
      return undefined;
    } else {
      return this.visitChildren(ctx);
    }
  }
}
