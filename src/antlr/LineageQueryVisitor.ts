import { Column, Lineage } from "../Lineage";
import { SqlBaseVisitor } from "./SqlBaseVisitor";
import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { Range } from "../utils/getRange";
import { ColumnRef, QuotableIdentifier, Relation } from "./common";
import { ParserRuleContext } from "antlr4ts";
import {
  AliasedQueryContext,
  ColumnReferenceContext,
  DereferenceContext,
  ExpressionContext,
  FromClauseContext,
  NamedExpressionContext,
  NamedQueryContext,
  PredicatedContext,
  PrimaryExpressionContext,
  QueryContext,
  RegularQuerySpecificationContext,
  StarContext,
  TableNameContext,
  ValueExpressionDefaultContext
} from "./SqlBaseParser";
import { LineageContext } from "./LineageContext";
import { TablePrimary } from "..";
import common from "./common";

// Query visitor is instantiated per query/subquery
// All shared state is hold in `lineageContext` which is shared across query visitors
export class LineageQueryVisitor<TableData extends { id: TablePrimary }, ColumnData extends { id: string }>
  extends AbstractParseTreeVisitor<Lineage<TableData, ColumnData> | undefined>
  implements SqlBaseVisitor<Lineage<TableData, ColumnData> | undefined> {
  private readonly id;

  private topQuery = true;

  // sequence generator for columns in this context
  private columnIdSeq = 0;

  // columns for this query extracted from SELECT
  private columns: Array<Column<ColumnData>> = [];

  // CTEs from this context
  private ctes: Map<string, Relation<TableData, ColumnData>> = new Map();

  // relations for this context extracted from FROM
  private relations: Map<string, Relation<TableData, ColumnData>> = new Map();

  private isStar = false;

  private columnReferences: Array<ColumnRef> = [];

  constructor(
    private readonly lineageContext: LineageContext<TableData, ColumnData>,
    private readonly parent?: LineageQueryVisitor<TableData, ColumnData>
  ) {
    super();
    this.id = lineageContext.getNextRelationId();
  }

  rangeFromContext(ctx: ParserRuleContext): Range {
    const stop = ctx.stop ?? ctx.start;
    return {
      startLine: ctx.start.line,
      endLine: stop.line,
      startColumn: ctx.start.charPositionInLine,
      endColumn: stop.charPositionInLine + (stop.stopIndex - stop.startIndex + 1)
    };
  }

  get level(): number {
    let level = 0;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cur: LineageQueryVisitor<TableData, ColumnData> = this;
    while (cur.parent !== undefined) {
      level++;
      cur = cur.parent;
    }
    return level;
  }

  protected findRelationInCtx(
    ctx: LineageQueryVisitor<TableData, ColumnData>,
    tableName: QuotableIdentifier
  ): Relation<TableData, ColumnData> | undefined {
    for (const rel of ctx.relations) {
      if (tableName.quoted) {
        if (rel[0] == tableName.name) return rel[1];
      } else {
        if (
          tableName.name.localeCompare(rel[0], undefined, {
            sensitivity: "accent"
          }) == 0
        )
          return rel[1];
      }
    }

    return undefined;
  }

  protected findRelation(tableName: QuotableIdentifier): Relation<TableData, ColumnData> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cur: LineageQueryVisitor<TableData, ColumnData> | undefined = this;
    while (cur != undefined) {
      const table = this.findRelationInCtx(cur, tableName);
      if (table !== undefined) return table;
      cur = cur.parent;
    }
    return undefined;
  }

  private findCTE(tableName: QuotableIdentifier): Relation<TableData, ColumnData> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cur: LineageQueryVisitor<TableData, ColumnData> | undefined = this;
    while (cur != undefined) {
      for (const rel of cur.ctes) {
        if (tableName.quoted) {
          if (rel[0] == tableName.name) return rel[1];
        } else {
          if (
            tableName.name.localeCompare(rel[0], undefined, {
              sensitivity: "accent"
            }) == 0
          )
            return rel[1];
        }
      }
      cur = cur.parent;
    }
    return undefined;
  }

  protected resolveColumn(columnName: QuotableIdentifier, tableName?: QuotableIdentifier): ColumnRef | undefined {
    if (tableName !== undefined) {
      const table = this.findRelation(tableName);
      const col = table?.columns.find(c =>
        columnName.quoted
          ? c.label == columnName.name
          : c.label.localeCompare(columnName.name, undefined, {
              sensitivity: "accent"
            }) == 0
      );
      if (table && col) {
        return { tableId: table.id, columnId: col.id };
      }
    } else {
      for (const r of this.relations) {
        const col = r[1].columns.find(c =>
          columnName.quoted
            ? c.label == columnName.name
            : c.label.localeCompare(columnName.name, undefined, {
                sensitivity: "accent"
              }) == 0
        );
        if (col) {
          return { tableId: r[1].id, columnId: col.id };
        }
      }
    }
    return undefined;
  }

  toRelation(range?: Range): Relation<TableData, ColumnData> {
    return new Relation<TableData, ColumnData>(this.id, this.columns, this.level, range);
  }

  get nextColumnId(): string {
    this.columnIdSeq++;
    return "column_" + this.columnIdSeq;
  }

  protected extractTableAndColumn(
    ctx: PrimaryExpressionContext
  ): { table?: QuotableIdentifier; column: QuotableIdentifier } | undefined {
    if (ctx instanceof ColumnReferenceContext) {
      return { column: common.stripQuote(ctx.identifier()) };
    } else if (ctx instanceof DereferenceContext) {
      const primary = ctx.primaryExpression();
      if (primary instanceof ColumnReferenceContext) {
        return {
          table: common.stripQuote(primary.identifier()),
          column: common.stripQuote(ctx.identifier())
        };
      }
    }
    return undefined;
  }

  protected deriveColumnName(ctx: ExpressionContext): string | undefined {
    const boolExpr = ctx.booleanExpression();
    if (boolExpr instanceof PredicatedContext) {
      const valExpr = boolExpr.valueExpression();
      if (valExpr instanceof ValueExpressionDefaultContext) {
        const tableCol = this.extractTableAndColumn(valExpr.primaryExpression());
        if (tableCol !== undefined) {
          return tableCol.column.name;
        }
      }
    }
    return undefined;
  }

  protected addRelationColumns(rel: Relation<TableData, ColumnData>, range: Range): Lineage<TableData, ColumnData> {
    const lineage: Lineage<TableData, ColumnData> = [];
    rel.columns.forEach(c => {
      const columnId = this.nextColumnId;
      const col = {
        id: columnId,
        label: c.label,
        range: range
      };
      this.columns.push(col);
      lineage.push({
        type: "edge",
        source: {
          tableId: rel.id,
          columnId: c.id
        },
        target: {
          tableId: this.id,
          columnId: columnId
        }
      });
    });
    return lineage;
  }

  //
  // Visitor method overrides
  //

  protected defaultResult(): Lineage<TableData, ColumnData> | undefined {
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
      const result = this.visitChildren(ctx);

      // to be consumed later
      this.lineageContext.relationsStack.push(this.toRelation(this.rangeFromContext(ctx)));

      return result;
    } else {
      const visitor = new LineageQueryVisitor(this.lineageContext, this);
      return ctx.accept(visitor);
    }
  }

  visitRegularQuerySpecification(ctx: RegularQuerySpecificationContext): Lineage<TableData, ColumnData> | undefined {
    // process FROM first to capture all available relations
    let lineage = ctx.fromClause()?.accept(this);

    // then process all remaining clauses
    ctx.children?.forEach(c => {
      if (!(c instanceof FromClauseContext)) {
        lineage = this.aggregateResult(lineage, c.accept(this));
      }
    });

    return lineage;
  }

  // processes table/CTE/correlated subquery references
  visitTableName(ctx: TableNameContext): Lineage<TableData, ColumnData> | undefined {
    const multipartTableName = ctx
      .multipartIdentifier()
      .errorCapturingIdentifier()
      .map(v => common.stripQuote(v.identifier()));

    const strictId = ctx.tableAlias().strictIdentifier();
    const alias = (strictId !== undefined
      ? common.stripQuote(strictId)
      : multipartTableName[multipartTableName.length - 1]
    ).name;

    if (multipartTableName.length == 1) {
      const cte = this.findCTE(multipartTableName[0]);
      if (cte !== undefined) {
        // found relation as CTE
        this.relations.set(alias, cte);
        return undefined; // no additional lineage, just an alias
      }

      const rel = this.findRelation(multipartTableName[0]);
      if (rel !== undefined) {
        // found relation as correllated sq
        if (multipartTableName[0].name != alias) {
          this.relations.set(alias, rel);
        }
        return undefined; // no additional lineage, just an alias
      }
    }

    const tablePrimary = common.tablePrimaryFromMultipart(multipartTableName.map(v => v.name));
    const metadata = this.lineageContext.getTable(tablePrimary);
    const columns = metadata.columns.map(c => ({
      id: c.id,
      label: c.id,
      data: c
    }));

    const relation = new Relation<TableData, ColumnData>(
      this.lineageContext.getNextRelationId(),
      columns,
      this.level + 1,
      this.rangeFromContext(ctx),
      metadata.table,
      tablePrimary.tableName
    );

    this.relations.set(alias, relation);
    return [relation.toLineage(alias)];
  }

  // processes CTE
  visitNamedQuery(ctx: NamedQueryContext): Lineage<TableData, ColumnData> | undefined {
    const lineage = this.visitChildren(ctx);

    // expecting query relation to be in stack
    const relation = this.lineageContext.relationsStack.pop();
    if (relation !== undefined) {
      const identifier = ctx.errorCapturingIdentifier().identifier();
      const alias = identifier !== undefined ? common.stripQuote(identifier).name : relation.id;
      this.ctes.set(alias, relation);
      return this.aggregateResult(lineage, [relation.toLineage(alias)]);
    } else {
      throw new Error("Expecting CTE query relation to be in stack");
    }
  }

  // processes subqueries
  visitAliasedQuery(ctx: AliasedQueryContext): Lineage<TableData, ColumnData> | undefined {
    const lineage = this.visitChildren(ctx);

    // expecting query relation to be in stack
    const relation = this.lineageContext.relationsStack.pop();
    if (relation !== undefined) {
      const strictId = ctx.tableAlias().strictIdentifier();
      const alias = strictId !== undefined ? common.stripQuote(strictId).name : relation.id;
      this.relations.set(alias, relation);
      return this.aggregateResult(lineage, [relation.toLineage(alias)]);
    } else {
      throw new Error("Expecting subquery relation to be in stack");
    }
  }

  visitNamedExpression(ctx: NamedExpressionContext): Lineage<TableData, ColumnData> | undefined {
    // clear array to start accumulating new references
    this.columnReferences.length = 0;

    this.isStar = false;
    const result = this.visitChildren(ctx);
    if (this.isStar) {
      this.isStar = false;
      return result;
    }

    const columnId = this.nextColumnId;
    const errCaptId = ctx.errorCapturingIdentifier();
    const label =
      errCaptId !== undefined
        ? common.stripQuote(errCaptId.identifier()).name
        : this.deriveColumnName(ctx.expression()) ?? columnId;

    const range = this.rangeFromContext(ctx);
    const column = {
      id: columnId,
      label: label,
      range: range
    };
    this.columns.push(column);
    const lineage: Lineage<TableData, ColumnData> = [];
    for (const c of this.columnReferences) {
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

  visitStar(ctx: StarContext): Lineage<TableData, ColumnData> | undefined {
    this.isStar = true;
    const range = this.rangeFromContext(ctx);
    const qualifiedName = ctx.qualifiedName();
    if (qualifiedName !== undefined) {
      // TODO support multipart table names
      const lastName = qualifiedName.identifier()[qualifiedName.identifier().length - 1];
      const tableName = common.stripQuote(lastName);
      const rel = this.findRelationInCtx(this, tableName);
      if (rel !== undefined) {
        return this.addRelationColumns(rel, range);
      }
    } else {
      let lineage: Lineage<TableData, ColumnData> | undefined = undefined;
      for (const r of this.relations) {
        lineage = this.aggregateResult(lineage, this.addRelationColumns(r[1], range));
      }
      return lineage;
    }
    return undefined;
  }

  visitColumnReference(ctx: ColumnReferenceContext): Lineage<TableData, ColumnData> | undefined {
    return this.visitPrimaryExpression(ctx);
  }

  visitDereference(ctx: DereferenceContext): Lineage<TableData, ColumnData> | undefined {
    return this.visitPrimaryExpression(ctx);
  }

  // this method is not called directly by visitChildren() but by above 2 methods
  visitPrimaryExpression(ctx: PrimaryExpressionContext): Lineage<TableData, ColumnData> | undefined {
    const tableCol = this.extractTableAndColumn(ctx);
    if (tableCol !== undefined) {
      const col = this.resolveColumn(tableCol.column, tableCol.table);
      if (col) {
        this.columnReferences.push(col);
      }
      return undefined;
    } else {
      return this.visitChildren(ctx);
    }
  }
}
