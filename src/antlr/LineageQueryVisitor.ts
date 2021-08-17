import { Column, EdgeType, Lineage, Table } from "../Lineage";
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
  GroupByClauseContext,
  HavingClauseContext,
  NamedExpressionContext,
  NamedQueryContext,
  PredicatedContext,
  PrimaryExpressionContext,
  QueryContext,
  QueryOrganizationContext,
  QueryTermDefaultContext,
  RegularQuerySpecificationContext,
  SelectClauseContext,
  StarContext,
  TableNameContext,
  ValueExpressionDefaultContext,
  WhereClauseContext
} from "./SqlBaseParser";
import { LineageContext } from "./LineageContext";
import common from "./common";
import { RuleNode } from "antlr4ts/tree/RuleNode";

// Query visitor is instantiated per query/subquery
// All shared state is hold in `lineageContext` which is shared across query visitors
export class LineageQueryVisitor<TableData, ColumnData>
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

  private currentClause?: EdgeType;

  private currentColumnId?: string;

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

  private getNextColumnId(): string {
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

  private isStar(ctx: ExpressionContext): StarContext | undefined {
    const boolExpr = ctx.booleanExpression();
    if (boolExpr instanceof PredicatedContext) {
      const valExpr = boolExpr.valueExpression();
      if (valExpr instanceof ValueExpressionDefaultContext) {
        const primaryExpr = valExpr.primaryExpression();
        if (primaryExpr instanceof StarContext) {
          return primaryExpr;
        }
      }
    }
    return undefined;
  }

  processStar(ctx: StarContext): Lineage<TableData, ColumnData> | undefined {
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

  protected addRelationColumns(rel: Relation<TableData, ColumnData>, range: Range): Lineage<TableData, ColumnData> {
    const lineage: Lineage<TableData, ColumnData> = [];
    rel.columns.forEach(c => {
      const columnId = this.getNextColumnId();
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

  private processClause(clause: EdgeType, ctx: RuleNode): Lineage<TableData, ColumnData> | undefined {
    this.currentClause = clause;
    const result = this.visitChildren(ctx);
    this.currentClause = undefined;
    return result;
  }

  private processColumnReference(
    ctx: ColumnReferenceContext | DereferenceContext
  ): Lineage<TableData, ColumnData> | undefined {
    const tableCol = this.extractTableAndColumn(ctx);
    if (tableCol !== undefined) {
      const col = this.resolveColumn(tableCol.column, tableCol.table);
      if (col) {
        return [
          {
            type: "edge",
            edgeType: this.currentClause,
            source: col,
            target: {
              tableId: this.id,
              columnId: this.currentColumnId
            }
          }
        ];
      }
      return undefined;
    } else {
      return this.visitChildren(ctx);
    }
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
      if (aggregate) {
        const additional: Lineage<TableData, ColumnData> = [];
        for (const e of nextResult) {
          if (e.type == "table" && e.level !== undefined) {
            const level = e.level;
            const existing = aggregate.find(
              t => t.type == "table" && t.id == e.id && t.level !== undefined && level >= t.level
            ) as Table<TableData, ColumnData>;
            if (existing !== undefined) {
              existing.level = level;
            } else {
              additional.push(e);
            }
          } else {
            additional.push(e);
          }
        }
        return aggregate.concat(additional);
      } else {
        return nextResult;
      }
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

  // processing set operations
  visitQueryTermDefault(ctx: QueryTermDefaultContext): Lineage<TableData, ColumnData> | undefined {
    // reinit column seq as we will repeat the same columns in subsequent queries
    this.columnIdSeq = 0;
    // clear relations for each queryTermDefault because it's individual query
    this.relations = new Map();
    return this.visitChildren(ctx);
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
        // found relation as correlated sq
        if (multipartTableName[0].name != alias) {
          this.relations.set(alias, rel);
        }
        return undefined; // no additional lineage, just an alias
      }
    }

    const tablePrimary = common.tablePrimaryFromMultipart(multipartTableName.map(v => v.name));

    const tablePrimaryStr = JSON.stringify(tablePrimary);

    if (this.lineageContext.mergedLeaves) {
      const existing = this.lineageContext.usedTables.get(tablePrimaryStr);
      if (existing !== undefined) {
        this.relations.set(alias, existing);
        if (this.level >= existing.level) {
          existing.level = this.level + 1;
        }
        return [existing.toLineage()]; // no additional lineage
      }
    }

    const metadata = this.lineageContext.getTable(tablePrimary);
    const columns =
      metadata?.columns.map(c => ({
        id: c.id,
        label: c.id,
        data: c.data
      })) || [];

    const relation = new Relation<TableData, ColumnData>(
      this.lineageContext.getNextRelationId(),
      columns,
      this.level + 1,
      this.rangeFromContext(ctx),
      metadata?.table.data,
      tablePrimary.tableName
    );

    this.lineageContext.usedTables.set(tablePrimaryStr, relation);
    this.relations.set(alias, relation);
    return [relation.toLineage(this.lineageContext.mergedLeaves ? undefined : alias)];
  }

  // processes CTE
  visitNamedQuery(ctx: NamedQueryContext): Lineage<TableData, ColumnData> | undefined {
    const lineage = this.visitChildren(ctx);

    // expecting query relation to be in stack
    let relation = this.lineageContext.relationsStack.pop();
    if (relation !== undefined) {
      const identifier = ctx.errorCapturingIdentifier().identifier();
      const alias = identifier !== undefined ? common.stripQuote(identifier).name : relation.id;

      const columnAliases = ctx
        .identifierList()
        ?.identifierSeq()
        .errorCapturingIdentifier()
        .map(eci => common.stripQuote(eci.identifier()).name);
      if (columnAliases !== undefined) {
        const newColumns = relation.columns.map((c, i) => {
          return {
            id: c.id,
            label: columnAliases[i] ?? c.label,
            range: c.range,
            data: c.data
          };
        });
        relation = new Relation(relation.id, newColumns, relation.level, relation.range, relation.data, relation.name);
      }

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
    let relation = this.lineageContext.relationsStack.pop();
    if (relation !== undefined) {
      const strictId = ctx.tableAlias().strictIdentifier();
      const alias = strictId !== undefined ? common.stripQuote(strictId).name : relation.id;
      const columnAliases = ctx
        .tableAlias()
        .identifierList()
        ?.identifierSeq()
        .errorCapturingIdentifier()
        .map(eci => common.stripQuote(eci.identifier()).name);
      if (columnAliases !== undefined) {
        const newColumns = relation.columns.map((c, i) => {
          return {
            id: c.id,
            label: columnAliases[i] ?? c.label,
            range: c.range,
            data: c.data
          };
        });
        relation = new Relation(relation.id, newColumns, relation.level, relation.range, relation.data, relation.name);
      }
      this.relations.set(alias, relation);
      return this.aggregateResult(lineage, [relation.toLineage(alias)]);
    } else {
      throw new Error("Expecting subquery relation to be in stack");
    }
  }

  visitSelectClause(ctx: SelectClauseContext): Lineage<TableData, ColumnData> | undefined {
    return this.processClause("select", ctx);
  }

  visitFromClause(ctx: FromClauseContext): Lineage<TableData, ColumnData> | undefined {
    return this.processClause("from", ctx);
  }

  visitWhereClause(ctx: WhereClauseContext): Lineage<TableData, ColumnData> | undefined {
    return this.processClause("where", ctx);
  }

  visitGroupByClause(ctx: GroupByClauseContext): Lineage<TableData, ColumnData> | undefined {
    return this.processClause("group by", ctx);
  }

  visitHavingClause(ctx: HavingClauseContext): Lineage<TableData, ColumnData> | undefined {
    return this.processClause("having", ctx);
  }

  visitQueryOrganization(ctx: QueryOrganizationContext): Lineage<TableData, ColumnData> | undefined {
    return this.processClause("order by", ctx);
  }

  visitNamedExpression(ctx: NamedExpressionContext): Lineage<TableData, ColumnData> | undefined {
    if (ctx.errorCapturingIdentifier() === undefined) {
      const star = this.isStar(ctx.expression());
      if (star !== undefined) {
        return this.processStar(star);
      }
    }

    const columnId = this.getNextColumnId();

    // column could have been already defined if we have set operation
    if (this.columns.find(c => c.id == columnId) === undefined) {
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
    }

    this.currentColumnId = columnId;
    const result = this.visitChildren(ctx);
    this.currentColumnId = undefined;

    return result;
  }

  visitColumnReference(ctx: ColumnReferenceContext): Lineage<TableData, ColumnData> | undefined {
    return this.processColumnReference(ctx);
  }

  visitDereference(ctx: DereferenceContext): Lineage<TableData, ColumnData> | undefined {
    return this.processColumnReference(ctx);
  }
}
