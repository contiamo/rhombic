import { Column, Lineage } from "../Lineage";
import { SqlBaseVisitor } from "./SqlBaseVisitor";
import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { Range } from "../utils/getRange";
import { ColumnRef, QuotableIdentifier, Relation } from "./model";
import { ParserRuleContext } from "antlr4ts";
import {
  AliasedQueryContext,
  ColumnReferenceContext,
  DereferenceContext,
  ExpressionContext,
  FromClauseContext,
  IdentifierContext,
  NamedExpressionContext,
  PredicatedContext,
  PrimaryExpressionContext,
  QueryContext,
  QuotedIdentifierAlternativeContext,
  RegularQuerySpecificationContext,
  StarContext,
  StrictIdentifierContext,
  TableNameContext,
  ValueExpressionDefaultContext
} from "./SqlBaseParser";
import { LineageContext } from "./LineageContext";
import { TablePrimary } from "..";

// Query visitor is instantiated per query/subquery
// All shared state is hold in `lineageContext` which is shared across query visitors
export class QueryVisitor<TableData extends { id: TablePrimary }, ColumnData extends { id: string }>
  extends AbstractParseTreeVisitor<Lineage<TableData, ColumnData> | undefined>
  implements SqlBaseVisitor<Lineage<TableData, ColumnData> | undefined> {
  private readonly id;

  private topQuery = true;

  // sequence generator for columns in this context
  private columnIdSeq = 0;

  // columns for this query extracted from SELECT
  private columns: Array<Column<ColumnData>> = [];

  // relations for this context extracted from FROM
  private relations: Map<string, Relation<TableData, ColumnData>> = new Map();

  private isStar = false;

  private columnReferences: Array<ColumnRef> = [];

  constructor(
    private readonly lineageContext: LineageContext<TableData, ColumnData>,
    private readonly parent?: QueryVisitor<TableData, ColumnData>
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
    let cur: QueryVisitor<TableData, ColumnData> = this;
    while (cur.parent !== undefined) {
      level++;
      cur = cur.parent;
    }
    return level;
  }

  protected stripQuoteFromText(text: string, quote: string): QuotableIdentifier {
    if (text.startsWith(quote) && text.endsWith(quote)) {
      return {
        name: text.substring(1, text.length - 1).replace(quote + quote, quote),
        quoted: true
      };
    } else {
      return {
        name: text,
        quoted: false
      };
    }
  }

  protected stripQuote(ctx: IdentifierContext | StrictIdentifierContext): QuotableIdentifier {
    const strictId = ctx instanceof StrictIdentifierContext ? ctx : ctx.strictIdentifier();
    if (strictId !== undefined) {
      if (strictId instanceof QuotedIdentifierAlternativeContext) {
        const quotedId = strictId.quotedIdentifier();
        const [doubleQuotedId, backquotedId] = [quotedId.DOUBLEQUOTED_IDENTIFIER(), quotedId.BACKQUOTED_IDENTIFIER()];
        if (doubleQuotedId !== undefined) {
          return this.stripQuoteFromText(doubleQuotedId.text, '"');
        } else if (backquotedId !== undefined) {
          return this.stripQuoteFromText(backquotedId.text, "`");
        }
      }
    }
    return {
      name: ctx.text,
      quoted: false
    };
  }

  protected findRelationInCtx(
    ctx: QueryVisitor<TableData, ColumnData>,
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
    let cur: QueryVisitor<TableData, ColumnData> | undefined = this;
    while (cur != undefined) {
      const table = this.findRelationInCtx(cur, tableName);
      if (table !== undefined) return table;
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
      return { column: this.stripQuote(ctx.identifier()) };
    } else if (ctx instanceof DereferenceContext) {
      const primary = ctx.primaryExpression();
      if (primary instanceof ColumnReferenceContext) {
        return {
          table: this.stripQuote(primary.identifier()),
          column: this.stripQuote(ctx.identifier())
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

  private tablePrimaryFromMultipart(names: string[]): TablePrimary {
    const len = names.length;
    if (len == 0) {
      throw new Error("Unexpected empty array for table name");
    } else if (len == 1) {
      return {
        tableName: names[0]
      };
    } else if (len == 2) {
      return {
        schemaName: names[0],
        tableName: names[1]
      };
    } else {
      return {
        catalogName: names[len - 3],
        schemaName: names[len - 2],
        tableName: names[len - 1]
      };
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
      const visitor = new QueryVisitor(this.lineageContext, this);
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

  visitTableName(ctx: TableNameContext): Lineage<TableData, ColumnData> | undefined {
    const multipartTableName = ctx
      .multipartIdentifier()
      .errorCapturingIdentifier()
      .map(v => this.stripQuote(v.identifier()).name);
    const tablePrimary = this.tablePrimaryFromMultipart(multipartTableName);
    const metadata = this.lineageContext.getTable(tablePrimary);
    const columns = metadata.columns.map(c => ({
      id: c.id,
      label: c.id,
      data: c
    }));

    const strictId = ctx.tableAlias().strictIdentifier();
    const alias =
      strictId !== undefined ? this.stripQuote(strictId).name : multipartTableName[multipartTableName.length - 1];

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

  visitAliasedQuery(ctx: AliasedQueryContext): Lineage<TableData, ColumnData> | undefined {
    const lineage = this.visitChildren(ctx);

    // expecting query relation to be in stack
    const relation = this.lineageContext.relationsStack.pop();
    if (relation !== undefined) {
      const strictId = ctx.tableAlias().strictIdentifier();
      const alias = strictId !== undefined ? this.stripQuote(strictId).name : relation.id;
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
        ? this.stripQuote(errCaptId.identifier()).name
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
      const tableName = this.stripQuote(lastName);
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
