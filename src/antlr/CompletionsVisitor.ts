import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import { ErrorNode } from "antlr4ts/tree/ErrorNode";
import {
  AliasedQueryContext,
  AliasedRelationContext,
  ColumnReferenceContext,
  DereferenceContext,
  NamedExpressionContext,
  NamedQueryContext,
  QueryContext,
  RegularQuerySpecificationContext,
  StarContext,
  StatementContext,
  TableNameContext
} from "./SqlBaseParser";
import { SqlBaseVisitor } from "./SqlBaseVisitor";

/**
 * A position in the sql source.
 */
export interface Position {
  lineNumber: number;
  column: number;
}

export type RelationName = string;
export type ColumnName = string;

/**
 * A column as it is available in the select clause of a query
 */
export interface ColumnDescription {
  relation: RelationName;
  name: ColumnName;
}

/**
 * Completable information of a query.
 */
export interface QueryInfo {
  availableColumns: ColumnDescription[];
  availableRelations: RelationName[];
}

/**
 * Snippets that can be added in the editor.
 */
export interface Snippet {
  label: string;
  template: string;
}

/**
 * This class represents a scope within a query. It contains information
 * about available columns (i.e. columns that can be used in the select
 * clause of a query), selected column in the sub-query and tables
 * visible in this part of the query.
 *
 * Each context has a reference to it's parent context (and will use it
 * to look up tables).
 */
class Context {
  private selectedColumns: ColumnName[] = [];
  private availableColumns: ColumnDescription[] = [];

  private environment: Map<RelationName, ColumnName[]> = new Map();

  constructor(private parent?: Context) {}

  /**
   * Add a column to the list of selected column in this sub-query.
   *
   * @param name name of the column as set in the select clause
   */
  addSelectedColumn(name: ColumnName) {
    this.selectedColumns.push(name);
  }

  /**
   * Add columns that are available in the sub-query (either from
   * a table or a sub-query in the from clause).
   *
   * @param relation The relation that contains the columns
   * @param columns The available columns in the relation
   */
  addAvailableColumns(relation: RelationName, columns: ColumnName[]) {
    this.availableColumns.push(
      ...columns.map(name => {
        return { relation, name };
      })
    );
  }

  /**
   * Add a relation that can be used in the from clause of a query. This
   * will either come from the global scope or a CTE.
   *
   * @param name The relation that contains the columns
   * @param columns The available columns in the relation
   */
  addRelation(name: RelationName, columns: ColumnName[]) {
    this.environment.set(name, columns);
  }

  /**
   * Retrieve the columns for a relation. This method will look up the
   * relation in this context and recursively its parent.
   *
   * @param relation The relation we want to read the columns from
   * @returns The names of columns in the relation.
   */
  getColumns(relation: RelationName): ColumnName[] {
    return this.environment.get(relation) ?? this.parent?.getColumns(relation) ?? [];
  }

  /**
   * Returns the columns selected in the sub-query for this context.
   *
   * @returns The columns that are selected in the current sub-query.
   */
  getSelectedColumns() {
    return this.selectedColumns;
  }

  /**
   * Retrieve the columns that are available in the sub-query (i.e. columns from
   * relations in the from clause).
   *
   * @param relation An optional name of the relation to filter columns by.
   * @returns The columns available (potentially filtered by the relation name)
   */
  getAvailableColumns(relation?: RelationName): ColumnName[] {
    if (relation === undefined) {
      return this.availableColumns.map(c => c.name);
    } else {
      return this.availableColumns.filter(c => c.relation === relation).map(c => c.name);
    }
  }

  private getRelations(): RelationName[] {
    return Array.from(this.environment.keys()).concat(this.parent?.getRelations() ?? []);
  }

  /**
   * Return all completable information about the sub-query for this context.
   *
   * @returns A compact representation of the completable information for the sub-query
   */
  getQueryInfo(): QueryInfo {
    return {
      availableColumns: this.availableColumns,
      availableRelations: this.getRelations()
    };
  }
}

/**
 * The part of the query to complete.
 */
type Scope = { type: "column" } | { type: "relation" } | { type: "dereference"; relation: string } | { type: "other" };

/**
 * The result of the completion task. Contains the completable information of the
 * (sub-)query, the part in which to complete and applicable snippets.
 */
interface Result {
  queryInfo: QueryInfo;
  scope: Scope;
  snippets: Snippet[];
}

/**
 * A visitor for the SQL ast that collects all required information for the auto completion.
 * The position for which to run completion will be identified via a special token (CARET: '<|>').
 */
export class CompletionVisitor extends AbstractParseTreeVisitor<void> implements SqlBaseVisitor<void> {
  static CURSOR_MARKER = "_CURSOR_";

  private context: Context = new Context();

  constructor(env: Map<string, string[]>) {
    super();

    env.forEach((columns, table) => {
      this.context.addRelation(table, columns);
    });
  }

  private queryInfo: QueryInfo | undefined;
  private scope: Scope | undefined;
  private snippets: Snippet[] = [];

  private inSelect = false;
  private foundCaret = false;

  getResult(): Result {
    if (this.queryInfo === undefined) {
      return {
        queryInfo: { availableColumns: [], availableRelations: [] },
        scope: this.scope ?? { type: "other" },
        snippets: this.snippets
      };
    }

    return { queryInfo: this.queryInfo, scope: this.scope ?? { type: "other" }, snippets: this.snippets };
  }

  defaultResult() {
    return;
  }

  aggregateResult(_acc: void, _next: void) {
    return;
  }

  private scoped(f: () => void): Context {
    const current = this.context;
    const newContext = new Context(current);
    this.context = newContext;
    f();
    this.context = current;
    return newContext;
  }

  /**
   * Called (for example) for the empty input. Verifies the source is actually empty and adds the
   * `SELECT FROM` snippet to the snippets list.
   *
   * @param node
   */
  visitErrorNode(node: ErrorNode) {
    if (node.symbol.text === CompletionVisitor.CURSOR_MARKER && node.parent instanceof StatementContext) {
      this.snippets.push({
        label: "SELECT ? FROM ?",
        template: "SELECT $0 FROM $1"
      });
      this.foundCaret = true;
    }
  }

  /**
   * Handle a cte.
   *
   * @param ctx
   */
  visitNamedQuery(ctx: NamedQueryContext) {
    const name = ctx.errorCapturingIdentifier().identifier().text;
    const columnAliases = ctx
      .identifierList()
      ?.identifierSeq()
      .errorCapturingIdentifier()
      .map(id => id.identifier().text);

    const childContext = this.scoped(() => this.visitChildren(ctx));

    const columnNames = columnAliases ?? childContext.getSelectedColumns();
    this.context.addRelation(name, columnNames);
  }

  /**
   * Handle a table reference in a from clause.
   *
   * @param ctx
   */
  visitTableName(ctx: TableNameContext) {
    const nameParts = ctx.multipartIdentifier().errorCapturingIdentifier();
    const name = nameParts[nameParts.length - 1].identifier().text;

    const alias = ctx.tableAlias().strictIdentifier()?.text;
    const columnAliases = ctx
      .tableAlias()
      .identifierList()
      ?.identifierSeq()
      .errorCapturingIdentifier()
      .map(id => id.identifier().text);

    const relationName = alias ?? name;
    const columnNames = columnAliases ?? this.context.getColumns(name);

    this.context.addAvailableColumns(relationName, columnNames);

    if (name.endsWith(CompletionVisitor.CURSOR_MARKER)) {
      this.scope = { type: "relation" };
      this.foundCaret = true;
    }
  }

  /**
   * Handle entries in the relation/FROM list that is enclosed in parenthesis.
   * We check if the parenthesis contain only the cursor and add the `SELECT FROM` snippet
   * to the snippets list (to initialize a sub-query).
   *
   * @param ctx
   */
  visitAliasedRelation(ctx: AliasedRelationContext) {
    this.visitChildren(ctx);

    const relation = ctx.relation();
    if (relation.start === relation.stop && relation.start.text === CompletionVisitor.CURSOR_MARKER) {
      this.snippets.push({
        label: "SELECT ? FROM ?",
        template: "SELECT $0 FROM $1"
      });
      this.foundCaret = true;
    }
  }

  /**
   * Handle a sub-query.
   *
   * @param ctx
   */
  visitAliasedQuery(ctx: AliasedQueryContext) {
    const name = ctx.tableAlias().strictIdentifier()?.text;
    const columnAliases = ctx
      .tableAlias()
      .identifierList()
      ?.identifierSeq()
      .errorCapturingIdentifier()
      .map(id => id.identifier().text);

    const childContext = this.scoped(() => this.visitChildren(ctx));

    const relationName = name ?? "";
    const columnNames = columnAliases ?? childContext.getSelectedColumns();

    this.context.addAvailableColumns(relationName, columnNames);
  }

  /**
   * Handle a query.
   *
   * @param ctx
   */
  visitRegularQuerySpecification(ctx: RegularQuerySpecificationContext) {
    ctx.fromClause()?.accept(this);

    this.inSelect = true;
    ctx.selectClause().accept(this);
    this.inSelect = false;

    ctx.lateralView().forEach(v => v.accept(this));
    ctx.whereClause()?.accept(this);
    ctx.aggregationClause()?.accept(this);
    ctx.windowClause()?.accept(this);
  }

  /**
   * Update the collected info if we reached the inner most query containing the caret.
   */
  visitQuery(ctx: QueryContext) {
    this.visitChildren(ctx);

    // inner most query containing the caret?
    if (this.queryInfo === undefined && this.foundCaret) {
      this.queryInfo = this.context.getQueryInfo();
    }
  }

  /**
   * Handle asterisks when selecting columns.
   * @param ctx
   */
  visitStar(ctx: StarContext) {
    const relationNameParts = ctx.qualifiedName()?.identifier();
    const relationName = relationNameParts && relationNameParts[relationNameParts.length - 1].text;

    const columns = this.context.getAvailableColumns(relationName);

    columns.forEach(cn => this.context.addSelectedColumn(cn));
  }

  /**
   * Handle selection expressions and note column aliases if provided.
   *
   * @param ctx
   * @returns
   */
  visitNamedExpression(ctx: NamedExpressionContext) {
    if (!this.inSelect) {
      return;
    }

    const columnAlias = ctx.errorCapturingIdentifier()?.identifier().text;

    if (columnAlias !== undefined) {
      this.context.addSelectedColumn(columnAlias);
      this.inSelect = false;
    }

    this.visitChildren(ctx);
    this.inSelect = true;
  }

  /**
   * Handle selection of column names.
   *
   * @param ctx
   */
  visitColumnReference(ctx: ColumnReferenceContext) {
    const name = ctx.identifier().text;
    if (this.inSelect) {
      this.context.addSelectedColumn(name);
    }

    if (name.endsWith(CompletionVisitor.CURSOR_MARKER)) {
      this.scope = { type: "column" };
      this.foundCaret = true;
    }
  }

  /**
   * Handle selection of column references `table.column`.
   *
   * @param ctx
   */
  visitDereference(ctx: DereferenceContext) {
    const name = ctx.identifier().text;
    if (this.inSelect) {
      this.context.addSelectedColumn(name);
    }

    if (name.endsWith(CompletionVisitor.CURSOR_MARKER)) {
      const ns = ctx.primaryExpression();
      if (ns instanceof ColumnReferenceContext) {
        this.scope = { type: "dereference", relation: ns.identifier().text };
      } else {
        this.scope = { type: "other" };
      }
      this.foundCaret = true;
    }
  }
}
