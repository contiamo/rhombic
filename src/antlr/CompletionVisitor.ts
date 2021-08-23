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

export type CompletionItem =
  | { type: "keyword"; value: string }
  | { type: "relation"; value: string }
  | { type: "column"; relation?: string; value: string }
  | { type: "snippet"; label: string; template: string };

type CaretScope =
  | { type: "select-column" }
  | { type: "spec-column" }
  | { type: "scoped-column"; relation: string }
  | { type: "relation" }
  | { type: "other" };

function availableColumns(relation: QueryRelation): { type: "column"; relation: string; value: string }[] {
  const columns: { type: "column"; relation: string; value: string }[] = [];

  relation.relations.forEach((rel, name) => {
    rel.columns.forEach(col => {
      columns.push({
        type: "column",
        relation: name,
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

export class CompletionVisitor extends QueryStructureVisitor<void> implements SqlBaseVisitor<void> {
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
  private hasCompletions: boolean = false;

  getSuggestions(): CompletionItem[] {
    return this.completionItems;
  }

  onRelation(relation: TableRelation | QueryRelation, _alias?: string): void {
    if (relation instanceof TableRelation) {
      return;
    }

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

  visitErrorNode(node: ErrorNode) {
    super.visitErrorNode(node);

    if (this.cursor.isEqualTo(node.symbol.text ?? "") && node.parent instanceof StatementContext) {
      this.completionItems.push(selectFromSnippet);
      this.caretScope = { type: "other" };
    }
  }

  visitTableName(ctx: TableNameContext) {
    const nameParts = ctx.multipartIdentifier().errorCapturingIdentifier();
    const name = nameParts[nameParts.length - 1].identifier().text;

    if (this.cursor.isSuffixOf(name)) {
      this.caretScope = { type: "relation" };
    }

    super.visitTableName(ctx);
  }

  visitAliasedRelation(ctx: AliasedRelationContext) {
    this.visitChildren(ctx);

    const relation = ctx.relation();
    if (relation.start === relation.stop && this.cursor.isEqualTo(relation.start.text ?? "")) {
      this.completionItems.push(selectFromSnippet);
      this.caretScope = { type: "relation" };
    }
  }

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
