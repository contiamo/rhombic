import { CharStreams, CommonTokenStream } from "antlr4ts";
import { Lineage, Table } from "../Lineage";
import { SqlBaseLexer } from "./SqlBaseLexer";
import { SqlBaseParser, StatementContext } from "./SqlBaseParser";
import { UppercaseCharStream } from "./UppercaseCharStream";
import { TablePrimary, TablePrimaryIncomplete } from "..";
import { ExtractTablesVisitor } from "./ExtractTablesVisitor";
import { LineageVisitor } from "./LineageVisitor";
import { CompletionVisitor } from "./CompletionVisitor";
import { Cursor } from "./Cursor";
import _ from "lodash";

export interface ParserOptions {
  doubleQuotedIdentifier?: boolean;
  cursorPosition?: { lineNumber: number; column: number };
}

interface Named {
  name: string;
}

/**
 * A `MetadataProvider` allows access to metadata of a project. It's used to compute
 * completion suggestions.
 */
export interface MetadataProvider<
  Catalog extends Named = Named,
  Schema extends Named = Named,
  Table extends Named = Named,
  Column extends Named = Named
> {
  getCatalogs: () => Catalog[];
  getSchemas: (arg?: { catalog: string }) => Schema[];
  getTables: (args?: { catalogOrSchema: string; schema?: string }) => Table[];
  getColumns: (args: { table: string; catalogOrSchema?: string; schema?: string }) => Column[];
}

/**
 * Possible suggestion items for auto completion.
 * "keyword" is not used right now but will likely be added later
 */
export type CompletionItem<Catalog = Named, Schema = Named, Table = Named, Column = Named> =
  | { type: "keyword"; value: string } // keyword suggestion
  | { type: "catalog"; value: Catalog } // catalog suggestion
  | { type: "schema"; value: Schema } // schema suggestion
  | { type: "relation"; value: string; desc?: Table } // table/cte suggestion
  | { type: "column"; relation?: string; value: string; desc?: Column } // column suggestion
  | { type: "snippet"; label: string; template: string }; // snippet suggestion

/**
 * Represents a parsed query and exposes methods to compute lineage and completion suggestions.
 */
class SqlParseTree {
  /**
   * @param tree The AST of the parsed query
   * @param cursor A representation of the cursor to look for in the query
   */
  constructor(public readonly tree: StatementContext, readonly cursor: Cursor) {}

  /**
   * Returns references to tables and catalogs contained in the parsed query. The result
   * of this method can be used to prefetch metadata for these objects before computing
   * lineage and completion suggestions.
   *
   * @returns Complete and incomplete (i.e. with a trailing dot) table references
   *     as found in the query.
   */
  getUsedTables(): { references: TablePrimary[]; incomplete: TablePrimaryIncomplete[] } {
    const visitor = new ExtractTablesVisitor(this.cursor);
    return this.tree.accept(visitor);
  }

  /**
   * This method computes lineage information for the parsed query. The result contains relations
   * (such as tables, ctes and subqueries) and edges representing column references betweend them.
   *
   * The method uses the provided lookup function `getTable` to understand where columns are
   * defined for referenced tables. The extra data for tables and columns (in the respective `data`
   * fields) will also be returned.
   *
   * @param getTable A lookup function to get the columns for a referenced table
   * @param mergedLeaves if true, references to the same table will point to the same node
   * @param options extra options for extracting lineage; can be used to enable handling
   *     of positional column references
   * @returns lineage data for the parsed query
   */
  getLineage<TableData, ColumnData>(
    getTable: (
      id: TablePrimary
    ) => { table: { id: string; data: TableData }; columns: { id: string; data: ColumnData }[] } | undefined,
    mergedLeaves?: boolean,
    options?: {
      positionalRefsEnabled?: boolean;
    }
  ): Lineage<TableData, ColumnData> {
    const visitor = new LineageVisitor<TableData, ColumnData>(tp => getTable(this.cursor.removeFrom(tp)), options);
    this.tree.accept(visitor);
    const tables = visitor.tables;
    const edges = visitor.edges;

    const cleanedTables: Table<TableData, ColumnData>[] = [];

    // do lineage cleanup if mergedLeaves is true
    if (mergedLeaves) {
      // 1. remove duplicate table references from the list of tables
      const deduplicateTable: Map<string, string> = new Map();
      const usedTables: Map<string, string> = new Map();

      tables.forEach(t => {
        if (t.tablePrimary === undefined) {
          cleanedTables.push(t.table);
          return;
        }

        const key = JSON.stringify(t.tablePrimary);
        const entry = usedTables.get(key);
        if (entry !== undefined) {
          deduplicateTable.set(t.table.id, entry);
        } else {
          usedTables.set(key, t.table.id);
          t.table.label = t.tablePrimary.tableName;
          cleanedTables.push(t.table);
        }
      });

      // 2. remove references to duplicate tables from edges and collect used columns of tables
      const usedColumns: Map<string, string[]> = new Map();

      edges.forEach(e => {
        const remappedSourceTable = deduplicateTable.get(e.source.tableId);
        if (remappedSourceTable !== undefined) {
          e.source.tableId = remappedSourceTable;
        }
        if (e.source.columnId !== undefined) {
          const columns = usedColumns.get(e.source.tableId);
          if (columns !== undefined) {
            columns.push(e.source.columnId);
          } else {
            usedColumns.set(e.source.tableId, [e.source.columnId]);
          }
        }
      });

      // 3. leave only columns that are used in tables
      cleanedTables.forEach(t => {
        if (t.data !== undefined) {
          const tableColumns = usedColumns.get(t.id);
          t.columns = t.columns.filter(c => tableColumns?.includes(c.id));
        }
      });
    } else {
      tables.forEach(t => cleanedTables.push(t.table));
    }

    return ([] as Lineage<TableData, ColumnData>).concat(cleanedTables, edges);
  }

  /**
   * This method computes completion suggestions at the cursor position for the parsed query.
   *
   * @param metadataProvider Metadata lookup functions
   * @returns A list of possible completions at the cursor position in the parsed query
   */
  getSuggestions<
    Catalog extends Named = Named,
    Schema extends Named = Named,
    Table extends Named = Named,
    Column extends Named = Named
  >(
    metadataProvider: MetadataProvider<Catalog, Schema, Table, Column>
  ): CompletionItem<Catalog, Schema, Table, Column>[] {
    const completionVisitor = new CompletionVisitor(this.cursor, args => metadataProvider.getColumns(args));
    this.tree.accept(completionVisitor);

    const completions = completionVisitor.getSuggestions();
    const completionItems: CompletionItem<Catalog, Schema, Table, Column>[] = [];
    switch (completions.type) {
      case "column": {
        const columns: CompletionItem<Catalog, Schema, Table, Column>[] = completions.columns.map(col => {
          return { type: "column", relation: col.relation, value: col.name, desc: col.desc };
        });

        completionItems.push(...columns);
        break;
      }
      case "relation": {
        // always include cte names
        const cteCompletions: CompletionItem<Catalog, Schema, Table, Column>[] = completions.relations.map(rel => {
          return { type: "relation", value: rel };
        });
        completionItems.push(...cteCompletions);

        // fetch tables
        const args = completions.incompleteReference && {
          catalogOrSchema: completions.incompleteReference.references[0],
          schema: completions.incompleteReference.references[1]
        };
        const tableCompletions: CompletionItem<Catalog, Schema, Table, Column>[] = metadataProvider
          .getTables(args)
          .map(t => {
            return { type: "relation", value: t.name, desc: t };
          });
        completionItems.push(...tableCompletions);

        // fetch schemas if only a one-part prefix (or no prefix) was entered
        if (completions.incompleteReference === undefined || completions.incompleteReference.references.length == 1) {
          const args = completions.incompleteReference && { catalog: completions.incompleteReference.references[0] };
          const schemaCompletions: CompletionItem<Catalog, Schema, Table, Column>[] = metadataProvider
            .getSchemas(args)
            .map(s => {
              return { type: "schema", value: s };
            });
          completionItems.push(...schemaCompletions);
        }

        // fetch catalogs if no prefix was entered
        if (completions.incompleteReference === undefined) {
          const catalogCompletions: CompletionItem<
            Catalog,
            Schema,
            Table,
            Column
          >[] = metadataProvider.getCatalogs().map(c => {
            return { type: "catalog", value: c };
          });
          completionItems.push(...catalogCompletions);
        }

        break;
      }
    }

    const snippets: CompletionItem<Catalog, Schema, Table, Column>[] = completions.snippets.map(s => {
      return { type: "snippet", label: s.label, template: s.template };
    });

    completionItems.push(...snippets);

    return completionItems;
  }
}

const defaultCursor = new Cursor("_CURSOR_");

const antlr = {
  /**
   * This method parses the provided sql and returns a `SqlParseTree` instance for
   * the parsed query.
   *
   * @param sql The sql to parse
   * @param options extra options for parsing; should contain the cursor position and
   *     can be used to control quoting.
   * @returns A `SqlParseTree` instance representing the parsed query
   */
  parse(sql: string, options?: ParserOptions): SqlParseTree {
    const doubleQuotedIdentifier = options?.doubleQuotedIdentifier ?? false;

    if (options?.cursorPosition !== undefined) {
      sql = defaultCursor.insertAt(sql, options.cursorPosition);
    }

    const inputStream = new UppercaseCharStream(CharStreams.fromString(sql));
    const lexer = new SqlBaseLexer(inputStream);
    lexer.doublequoted_identifier = doubleQuotedIdentifier;
    const tokens = new CommonTokenStream(lexer);
    const parser = new SqlBaseParser(tokens);
    parser.doublequoted_identifier = doubleQuotedIdentifier;
    parser.buildParseTree = true;
    parser.removeErrorListeners();
    return new SqlParseTree(parser.statement(), defaultCursor);
  }
};

export default antlr;
