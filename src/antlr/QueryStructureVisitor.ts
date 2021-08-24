import { EdgeType } from "../Lineage";
import { SqlBaseVisitor } from "./SqlBaseVisitor";
import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { Range } from "../utils/getRange";
import { ColumnRef, QuotableIdentifier } from "./common";
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
import common from "./common";
import { RuleNode } from "antlr4ts/tree/RuleNode";
import { TablePrimary } from "..";

const ROOT_QUERY_ID = "result_1";
export const ROOT_QUERY_NAME = "[final result]";

export class Column {
  constructor(readonly id: string, public label: string, readonly range?: Range, readonly data?: unknown) {}
}

export interface Relation {
  readonly id: string;
  readonly parent?: QueryRelation;
  readonly range?: Range;
  readonly columns: Array<Column>;
}

export class TableRelation implements Relation {
  constructor(
    readonly id: string,
    readonly tablePrimary: TablePrimary,
    readonly columns: Array<Column>,
    readonly parent?: QueryRelation,
    readonly range?: Range,
    readonly data?: unknown
  ) {}
}

export class QueryRelation implements Relation {
  // columns for this query extracted from SELECT
  columns: Array<Column> = [];

  // CTEs from this context
  ctes: Map<string, QueryRelation> = new Map();

  // relations for this context extracted from FROM
  relations: Map<string, Relation> = new Map();

  // sequence generator for columns in this context
  columnIdSeq = 0;

  currentClause?: EdgeType;

  currentColumnId?: string;

  constructor(readonly id: string, readonly parent?: QueryRelation, readonly range?: Range) {}

  findLocalRelation(tableName: QuotableIdentifier): Relation | undefined {
    for (const rel of this.relations) {
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

  findRelation(tableName: QuotableIdentifier): Relation | undefined {
    return this.findLocalRelation(tableName) ?? this.parent?.findRelation(tableName);
  }

  findCTE(tableName: QuotableIdentifier): Relation | undefined {
    for (const rel of this.ctes) {
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

    return this.parent?.findCTE(tableName);
  }

  resolveColumn(columnName: QuotableIdentifier, tableName?: QuotableIdentifier): ColumnRef | undefined {
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

  getNextColumnId(): string {
    this.columnIdSeq++;
    return "column_" + this.columnIdSeq;
  }
}

export abstract class QueryStructureVisitor<Result> extends AbstractParseTreeVisitor<Result>
  implements SqlBaseVisitor<Result> {
  private relationSeq = 0;

  public lastRelation: QueryRelation | undefined;

  protected currentRelation = new QueryRelation(this.getNextRelationId());

  constructor(
    public getTable: (
      table: TablePrimary
    ) => { table: { id: string; data: unknown }; columns: { id: string; data: unknown }[] } | undefined
  ) {
    super();
  }

  getNextRelationId(): string {
    return `result_${this.relationSeq++}`;
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

  /**
   *  Extracts table and column names from PrimaryExpressionContext (if possible).
   */

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

  /**
   *  Derives column name from expression if possible.
   */

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

  /**
   *  Determines whether expression is a star.
   */

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

  /**
   * Called when relation is ready.
   * @param _relation
   * @param _alias
   * @returns
   */
  onRelation(_relation: TableRelation | QueryRelation, _alias?: string): void {
    return;
  }

  /**
   * Called when column reference is ready.
   * @param _tableId
   * @param _columnId
   * @returns
   */
  onColumnReference(_tableId: string, _columnId: string): void {
    return;
  }

  processStar(ctx: StarContext): Result {
    const range = this.rangeFromContext(ctx);
    const qualifiedName = ctx.qualifiedName();
    if (qualifiedName !== undefined) {
      // TODO support multipart table names
      const lastName = qualifiedName.identifier()[qualifiedName.identifier().length - 1];
      const tableName = common.stripQuote(lastName);
      const rel = this.currentRelation.findLocalRelation(tableName);
      if (rel !== undefined) {
        this.addRelationColumns(rel, range);
      }
    } else {
      for (const r of this.currentRelation.relations) {
        this.addRelationColumns(r[1], range);
      }
    }

    return this.visitChildren(ctx);
  }

  protected addRelationColumns(rel: Relation, range: Range): void {
    rel.columns.forEach(c => {
      const columnId = this.currentRelation.getNextColumnId();
      const col = new Column(columnId, c.label, range);
      this.currentRelation.columns.push(col);
      this.currentRelation.currentColumnId = columnId;
      this.onColumnReference(rel.id, c.id);
      this.currentRelation.currentColumnId = undefined;
    });
  }

  private processClause(clause: EdgeType, ctx: RuleNode): Result {
    this.currentRelation.currentClause = clause;
    const result = this.visitChildren(ctx);
    this.currentRelation.currentClause = undefined;
    return result;
  }

  //
  // Visitor method overrides
  //

  visitQuery(ctx: QueryContext): Result {
    this.currentRelation = new QueryRelation(
      this.getNextRelationId(),
      this.currentRelation,
      this.rangeFromContext(ctx)
    );

    const result = this.visitChildren(ctx);

    // to be consumed later
    this.lastRelation = this.currentRelation;
    if (this.currentRelation.id == ROOT_QUERY_ID) this.onRelation(this.currentRelation, ROOT_QUERY_NAME);
    this.currentRelation = this.currentRelation.parent ?? new QueryRelation(this.getNextRelationId());
    return result;
  }

  /**
   * Processing set operations.
   */
  visitQueryTermDefault(ctx: QueryTermDefaultContext): Result {
    // reinit column seq as we will repeat the same columns in subsequent queries
    this.currentRelation.columnIdSeq = 0;
    // clear relations for each queryTermDefault because it's individual query
    this.currentRelation.relations = new Map();
    return this.visitChildren(ctx);
  }

  visitRegularQuerySpecification(ctx: RegularQuerySpecificationContext): Result {
    // process FROM first to capture all available relations
    let result = ctx.fromClause()?.accept(this) ?? this.defaultResult();

    // then process all remaining clauses
    ctx.children?.forEach(c => {
      if (!(c instanceof FromClauseContext)) {
        result = this.aggregateResult(result, c.accept(this));
      }
    });

    return result;
  }

  // processes table/CTE/correlated subquery references
  visitTableName(ctx: TableNameContext): Result {
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
      const cte = this.currentRelation.findCTE(multipartTableName[0]);
      if (cte !== undefined) {
        // found relation as CTE
        this.currentRelation.relations.set(alias, cte);
        return this.defaultResult();
      }

      const rel = this.currentRelation.findRelation(multipartTableName[0]);
      if (rel !== undefined) {
        // found relation as correlated sq
        if (multipartTableName[0].name != alias) {
          this.currentRelation.relations.set(alias, rel);
        }
        return this.defaultResult();
      }
    }

    const tablePrimary = common.tablePrimaryFromMultipart(multipartTableName.map(v => v.name));

    const metadata = this.getTable(tablePrimary);
    const columns = metadata?.columns.map(c => new Column(c.id, c.id, undefined, c.data)) || [];

    const relation = new TableRelation(
      this.getNextRelationId(),
      tablePrimary,
      columns,
      this.currentRelation,
      this.rangeFromContext(ctx),
      metadata?.table.data
    );

    this.currentRelation.relations.set(alias, relation);
    this.onRelation(relation, alias);

    return this.defaultResult();
  }

  // processes CTE
  visitNamedQuery(ctx: NamedQueryContext): Result {
    const result = this.visitChildren(ctx);

    // expecting query relation to be in stack
    const relation = this.lastRelation;
    if (relation !== undefined) {
      const identifier = ctx.errorCapturingIdentifier().identifier();
      const alias = identifier !== undefined ? common.stripQuote(identifier).name : relation.id;

      const columnAliases = ctx
        .identifierList()
        ?.identifierSeq()
        .errorCapturingIdentifier()
        .map(eci => common.stripQuote(eci.identifier()).name);
      if (columnAliases !== undefined) {
        relation.columns.forEach((c, i) => {
          c.label = columnAliases[i] ?? c.label;
        });
      }

      this.currentRelation.ctes.set(alias, relation);
      this.onRelation(relation, alias);
      return result;
    } else {
      throw new Error("Expecting CTE query relation to be in stack");
    }
  }

  // processes subqueries
  visitAliasedQuery(ctx: AliasedQueryContext): Result {
    const result = this.visitChildren(ctx);

    // expecting query relation to be in stack
    const relation = this.lastRelation;
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
        relation.columns.forEach((c, i) => {
          c.label = columnAliases[i] ?? c.label;
        });
      }
      this.currentRelation.relations.set(alias, relation);
      this.onRelation?.(relation, alias);
      return result;
    } else {
      throw new Error("Expecting subquery relation to be in stack");
    }
  }

  visitSelectClause(ctx: SelectClauseContext): Result {
    return this.processClause("select", ctx);
  }

  visitFromClause(ctx: FromClauseContext): Result {
    return this.processClause("from", ctx);
  }

  visitWhereClause(ctx: WhereClauseContext): Result {
    return this.processClause("where", ctx);
  }

  visitGroupByClause(ctx: GroupByClauseContext): Result {
    return this.processClause("group by", ctx);
  }

  visitHavingClause(ctx: HavingClauseContext): Result {
    return this.processClause("having", ctx);
  }

  visitQueryOrganization(ctx: QueryOrganizationContext): Result {
    return this.processClause("order by", ctx);
  }

  visitNamedExpression(ctx: NamedExpressionContext): Result {
    if (ctx.errorCapturingIdentifier() === undefined) {
      const star = this.isStar(ctx.expression());
      if (star !== undefined) {
        return this.processStar(star);
      }
    }

    const columnId = this.currentRelation.getNextColumnId();

    // column could have been already defined if we have set operation
    if (this.currentRelation.columns.find(c => c.id == columnId) === undefined) {
      const errCaptId = ctx.errorCapturingIdentifier();
      const label =
        errCaptId !== undefined
          ? common.stripQuote(errCaptId.identifier()).name
          : this.deriveColumnName(ctx.expression()) ?? columnId;

      const range = this.rangeFromContext(ctx);
      const column = new Column(columnId, label, range);
      this.currentRelation.columns.push(column);
    }

    this.currentRelation.currentColumnId = columnId;
    const result = this.visitChildren(ctx);
    this.currentRelation.currentColumnId = undefined;

    return result;
  }

  private processColumnReference(ctx: ColumnReferenceContext | DereferenceContext): Result {
    const tableCol = this.extractTableAndColumn(ctx);
    if (tableCol !== undefined) {
      const col = this.currentRelation.resolveColumn(tableCol.column, tableCol.table);
      if (col) {
        this.onColumnReference(col.tableId, col.columnId);
      }
      return this.defaultResult();
    } else {
      return this.visitChildren(ctx);
    }
  }

  visitColumnReference(ctx: ColumnReferenceContext): Result {
    return this.processColumnReference(ctx);
  }

  visitDereference(ctx: DereferenceContext): Result {
    return this.processColumnReference(ctx);
  }
}
