import { ErrorNode } from "antlr4ts/tree/ErrorNode";
import { TablePrimary } from "..";
import { CursorQuery } from "./Cursor";
import { QueryRelation, QueryStructureVisitor, TableRelation } from "./QueryStructureVisitor";
import {
  AliasedRelationContext,
  ColumnReferenceContext,
  DereferenceContext,
  StatementContext,
  TableNameContext
} from "./SqlBaseParser";
import { SqlBaseVisitor } from "./SqlBaseVisitor";

/**
 * Possible suggestion items for auto completion.
 * "keyword" is not used right now but will likely be added later
 */
export type CompletionItem =
  | { type: "keyword"; value: string } // keyword suggestion
  | { type: "relation"; value: string } // table/cte suggestion
  | { type: "column"; relation?: string; value: string } // column suggestion
  | { type: "snippet"; label: string; template: string }; // snippet suggestion

/**
 * The parts of the query the cursor can be in.
 */
type CaretScope =
  | { type: "select-column" } // cursor in column position within a SELECT clause
  | { type: "spec-column" } // cursor in column position outside of a SELECT clause
  | { type: "scoped-column"; relation: string } // cursor in column position after a dot (with `relation` being the prefix)
  | { type: "relation" } // cursor in table position
  | { type: "other" }; // cursor in any other position

function availableColumns(relation: QueryRelation): { type: "column"; relation?: string; value: string }[] {
  const columns: { type: "column"; relation?: string; value: string }[] = [];

  relation.relations.forEach((rel, name) => {
    const relationName = name !== rel.id ? name : undefined;

    rel.columns.forEach(col => {
      columns.push({
        type: "column",
        relation: relationName,
        value: col.label
      });
    });
  });

  return columns;
}

const selectFromSnippet: CompletionItem = {
  type: "snippet",
  label: "SELECT ? FROM ?",
  template: "SELECT $0 FROM $1"
};

/**
 * The visitor responsible for computing possible completion items based on the cursor position.
 *
 * This class performs two related tasks: identifying the subquery (and part of the query) where
 * the cursor is found in and collecting relevant details for completion at that point, such as
 * visible CTEs and columns of relations in the `FROM` clause.
 *
 * The cursor handling is delegated to the `Cursor` instance that is provided in the constructor.
 */
export class CompletionVisitor extends QueryStructureVisitor<void> implements SqlBaseVisitor<void> {
  /**
   * @param cursor Utility functions to identify the cursor within the query
   * @param getTables Fetch a list of available tables (to present as completion items)
   * @param getTable Fetch details (such as available columns) for a table
   */
  constructor(
    private readonly cursor: CursorQuery,
    readonly getTables: () => TablePrimary[],
    getTable: (
      t: TablePrimary
    ) => { table: { id: string; data: any }; columns: { id: string; data: any }[] } | undefined
  ) {
    super(getTable);
  }

  defaultResult() {}
  aggregateResult(_cur: void, _next: void) {}

  private caretScope?: CaretScope;
  private completionItems: CompletionItem[] = [];
  private hasCompletions = false;

  getSuggestions(): CompletionItem[] {
    return this.completionItems;
  }

  /**
   * This method is used to identify the inner most query the cursor is in and to then
   * compute the completion items from the query information.
   *
   * @param relation
   * @param _alias
   * @returns
   */
  onRelation(relation: TableRelation | QueryRelation, _alias?: string): void {
    if (relation instanceof TableRelation) {
      return;
    }

    // Is this the innermost query with the cursor inside
    if (!this.hasCompletions && this.caretScope !== undefined) {
      this.hasCompletions = true;
      switch (this.caretScope.type) {
        case "select-column":
          this.completionItems.push(...availableColumns(relation));
          break;

        case "spec-column":
          type ColSug = { type: "column"; relation?: string; value: string };
          const available: ColSug[] = availableColumns(relation);

          this.completionItems.push(...available);
          break;

        case "scoped-column":
          const relationName = this.caretScope.relation;
          const newCompletions: CompletionItem[] =
            relation.findLocalRelation({ name: relationName, quoted: false })?.columns.map(c => {
              return {
                type: "column",
                relation: relationName,
                value: c.label
              };
            }) ?? [];
          this.completionItems.push(...newCompletions);
          break;

        case "relation":
          const ctes: { type: "relation"; value: string }[] = relation.getCTENames().map(n => {
            return {
              type: "relation",
              value: n
            };
          });

          const tables: { type: "relation"; value: string }[] = this.getTables().map(table => {
            return {
              type: "relation",
              value: table.tableName
            };
          });

          this.completionItems.push(...tables, ...ctes);
          break;
      }
    }
  }

  /**
   * This method handles the case of an empty input to then provide the SELECTFROM snippet as
   * a completion item.
   *
   * @param node
   */
  visitErrorNode(node: ErrorNode) {
    super.visitErrorNode(node);

    if (this.cursor.isEqualTo(node.symbol.text ?? "") && node.parent instanceof StatementContext) {
      this.completionItems.push(selectFromSnippet);
      this.caretScope = { type: "other" };
    }
  }

  /**
   * Handle cases where the cursor is at the end of a table name (prefix).
   *
   * @param ctx
   */
  visitTableName(ctx: TableNameContext) {
    const nameParts = ctx.multipartIdentifier().errorCapturingIdentifier();
    const name = nameParts[nameParts.length - 1].identifier().text;

    if (this.cursor.isSuffixOf(name)) {
      this.caretScope = { type: "relation" };
    }

    super.visitTableName(ctx);
  }

  /**
   * Handle cases where the cursor is in the position of a table name, with no prefix provided.
   *
   * @param ctx
   */
  visitAliasedRelation(ctx: AliasedRelationContext) {
    this.visitChildren(ctx);

    const relation = ctx.relation();
    if (relation.start === relation.stop && this.cursor.isEqualTo(relation.start.text ?? "")) {
      this.completionItems.push(selectFromSnippet);
      this.caretScope = { type: "relation" };
    }
  }

  /**
   * Handle cases where the cursor is in the position of a column. We distinguish between
   * the cursor in a SELECT clause and in any other position (e.h. WHERE clause).
   * @param ctx
   */
  visitColumnReference(ctx: ColumnReferenceContext) {
    super.visitColumnReference(ctx);

    if (this.cursor.isSuffixOf(ctx.identifier().text)) {
      if (this.currentRelation.currentClause === "select") {
        this.caretScope = { type: "select-column" };
      } else {
        this.caretScope = { type: "spec-column" };
      }
    }
  }

  /**
   * Handle cases, where the cursor is right after a dot to suggest columns for the relevant prefix.
   *
   * @param ctx
   */
  visitDereference(ctx: DereferenceContext) {
    super.visitDereference(ctx);

    if (this.cursor.isSuffixOf(ctx.identifier().text)) {
      const ns = ctx.primaryExpression();
      if (ns instanceof ColumnReferenceContext) {
        this.caretScope = { type: "scoped-column", relation: ns.identifier().text };
      } else {
        this.caretScope = { type: "other" };
      }
    }
  }
}
