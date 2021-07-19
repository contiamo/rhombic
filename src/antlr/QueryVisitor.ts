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
  StrictIdentifierContext,
  TableNameContext,
  ValueExpressionDefaultContext
} from "./SqlBaseParser";
import { LineageContext } from "./LineageContext";

export class QueryVisitor<TableData extends { id: string }, ColumnData extends { id: string }>
  extends AbstractParseTreeVisitor<Lineage<TableData, ColumnData> | undefined>
  implements SqlBaseVisitor<Lineage<TableData, ColumnData> | undefined> {
  private id;

  private topQuery = true;

  // sequence generator for columns in this context
  private columnIdSeq = 0;

  // columns for this query extracted from SELECT
  columns: Array<Column<ColumnData>> = [];

  // relations for this context extracted from FROM
  relations: Map<string, Relation<TableData, ColumnData>> = new Map();

  columnReferences: Array<ColumnRef> = [];

  globals: LineageContext<TableData, ColumnData>;

  // parent reference, used for name resolution
  readonly parent?: QueryVisitor<TableData, ColumnData>;

  constructor(globals: LineageContext<TableData, ColumnData>, parent?: QueryVisitor<TableData, ColumnData>) {
    super();
    this.globals = globals;
    this.parent = parent;
    this.id = this.globals.nextRelationId;
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
        if (quotedId.DOUBLEQUOTED_IDENTIFIER() !== undefined) {
          return this.stripQuoteFromText(quotedId.DOUBLEQUOTED_IDENTIFIER()!.text, '"');
        } else if (quotedId.BACKQUOTED_IDENTIFIER() !== undefined) {
          return this.stripQuoteFromText(quotedId.BACKQUOTED_IDENTIFIER()!.text, "`");
        }
      }
    }
    return {
      name: ctx.text,
      quoted: false
    };
  }

  protected findRelation(tableName: QuotableIdentifier): Relation<TableData, ColumnData> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cur: QueryVisitor<TableData, ColumnData> | undefined = this;
    while (cur != undefined) {
      for (const rel of cur.relations) {
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
      this.globals.relationsStack.push(this.toRelation(this.rangeFromContext(ctx)));

      return result;
    } else {
      const visitor = new QueryVisitor(this.globals, this);
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
      .map(v => {
        return this.stripQuote(v.identifier()).name;
      });
    const tableName = multipartTableName.join(".");
    const tableData = this.globals.getters.getTable(tableName);
    const columns = this.globals.getters.getColumns(tableName).map(c => ({
      id: c.id,
      label: c.id,
      data: c
    }));

    const strictId = ctx.tableAlias().strictIdentifier();
    const alias =
      strictId !== undefined ? this.stripQuote(strictId).name : multipartTableName[multipartTableName.length - 1];

    const relation = new Relation(
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

  visitAliasedQuery(ctx: AliasedQueryContext): Lineage<TableData, ColumnData> | undefined {
    const lineage = this.visitChildren(ctx);

    // expecting query relation to be in stack
    const relation = this.globals.relationsStack.pop()!;
    const strictId = ctx.tableAlias().strictIdentifier();
    const alias = strictId !== undefined ? this.stripQuote(strictId).name : relation.id;
    this.relations.set(alias, relation);
    return this.aggregateResult(lineage, [relation.toLineage(alias)]);
  }

  visitNamedExpression(ctx: NamedExpressionContext): Lineage<TableData, ColumnData> | undefined {
    // clear array to start accumulating new references
    this.columnReferences.length = 0;

    const result = this.visitChildren(ctx);

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
