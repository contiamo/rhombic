import { ErrorNode } from "antlr4ts/tree/ErrorNode";
import { TablePrimary, TablePrimaryIncomplete } from "..";
import common from "./common";
import { CursorQuery } from "./Cursor";
import { QueryRelation, QueryStructureVisitor, TableRelation } from "./QueryStructureVisitor";
import {
  AliasedRelationContext,
  ColumnReferenceContext,
  DereferenceContext,
  QueryTermDefaultContext,
  StatementContext,
  TableNameContext
} from "./SqlBaseParser";
import { SqlBaseVisitor } from "./SqlBaseVisitor";

export type ContextCompletions =
  | { type: "column"; columns: { relation?: string; name: string }[] }
  | { type: "relation"; incompleteReference?: TablePrimaryIncomplete; relations: string[] }
  | { type: "other" };

export interface Snippet {
  label: string;
  template: string;
}

export interface Snippets {
  snippets: Snippet[];
}

export type Completions = ContextCompletions & Snippets;

/**
 * The parts of the query the cursor can be in.
 */
type CaretScope =
  | { type: "select-column" } // cursor in column position within a SELECT clause
  | { type: "spec-column" } // cursor in column position outside of a SELECT clause
  | { type: "scoped-column"; relation: string } // cursor in column position after a dot (with `relation` being the prefix)
  | { type: "relation"; prefix: string[] } // cursor in table position
  | { type: "other" }; // cursor in any other position

function availableColumns(relation: QueryRelation): { relation?: string; name: string }[] {
  const columns: { relation?: string; name: string }[] = [];

  relation.relations.forEach((rel, name) => {
    const relationName = name !== rel.id ? name : undefined;

    rel.columns.forEach(col => {
      columns.push({
        relation: relationName,
        name: col.label
      });
    });
  });

  return columns;
}

const selectFromSnippet = {
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
    getTable: (
      t: TablePrimary
    ) => { table: { id: string; data: unknown }; columns: { id: string; data: unknown }[] } | undefined
  ) {
    super(getTable);
  }

  defaultResult() {
    return;
  }
  aggregateResult(_cur: void, _next: void) {
    return;
  }

  private caretScope?: CaretScope;
  private hasCompletions = false;
  private completions: Completions = { type: "other", snippets: [] };

  getSuggestions(): Completions {
    return this.completions;
  }

  /**
   * Checks if tyhe provided query is the innermost query containing the cursor.
   * If so, compute the completion suggestions for that query.
   *
   * @param relation the current relation to consider
   */
  private updateCompletionItems(relation: QueryRelation) {
    // Is this the innermost query with the cursor inside
    if (!this.hasCompletions && this.caretScope !== undefined) {
      this.hasCompletions = true;
      switch (this.caretScope.type) {
        case "select-column":
        case "spec-column":
          this.completions = {
            type: "column",
            columns: availableColumns(relation),
            snippets: this.completions.snippets
          };
          break;

        case "scoped-column": {
          const relationName = this.caretScope.relation;
          const newCompletions: { relation?: string; name: string }[] =
            relation.findLocalRelation({ name: relationName, quoted: false })?.columns.map(c => {
              return {
                relation: relationName,
                name: c.label
              };
            }) ?? [];
          this.completions = { type: "column", columns: newCompletions, snippets: this.completions.snippets };
          break;
        }
        case "relation": {
          const ctes: string[] = relation.getCTENames();

          this.completions = {
            type: "relation",
            incompleteReference: this.caretScope.prefix.length > 0 ? { references: this.caretScope.prefix } : undefined,
            relations: ctes,
            snippets: this.completions.snippets
          };
          break;
        }
      }
    }
  }

  /**
   * In case a query has been completely handled by this visitor we may need to update the completions.
   *
   * This is called for the whole query (including query organization features). For simple query terms
   * (like the individual parts of a UNION query) are handled by the `visitQueryTermDefault` method.
   *
   * @param relation
   * @param _alias
   * @returns
   */
  onRelation(relation: TableRelation | QueryRelation, _alias?: string) {
    if (relation instanceof TableRelation) {
      return;
    }

    this.updateCompletionItems(relation);
  }

  /**
   * In case we handled a query term we need to potentially update the completions.
   *
   * This is called for query terms e.g. within set operations. We need this in addition
   * to `onRelation` to make sure we can complete in the individual sub-queries of set
   * operations.
   *
   * @param ctx
   */
  visitQueryTermDefault(ctx: QueryTermDefaultContext) {
    super.visitQueryTermDefault(ctx);

    this.updateCompletionItems(this.currentRelation);
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
      this.completions.snippets.push(selectFromSnippet);
      this.caretScope = { type: "other" };
    }
  }

  /**
   * Handle cases where the cursor is at the end of a table name (prefix).
   *
   * @param ctx
   */
  visitTableName(ctx: TableNameContext) {
    const multipartTableName = ctx
      .multipartIdentifier()
      .errorCapturingIdentifier()
      .map(v => common.stripQuote(v.identifier()).name);
    const lastPart = multipartTableName[multipartTableName.length - 1];

    if (this.cursor.isSuffixOf(lastPart)) {
      this.caretScope = { type: "relation", prefix: multipartTableName.slice(0, -1) };
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
      this.completions.snippets.push(selectFromSnippet);
      this.caretScope = { type: "relation", prefix: [] };
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
