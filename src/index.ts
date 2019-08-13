import { parseSql } from "./SqlParser";
import { HasFromVisitor } from "./visitors/HasFromVisitor";
import { ProjectionItemsVisitor } from "./visitors/ProjectionItemsVisitor";
import { insertText } from "./utils/insertText";
import { CstNode } from "chevrotain";
import { HasTablePrimary } from "./visitors/HasTablePrimaryVisitor";
import { reserved } from "./reserved";

const rhombic = {
  /**
   * Parse a sql statement.
   *
   * @param sql
   */
  parse(sql: string) {
    return parsedSql(sql);
  }
};

// Note: Because we have a recursion, we can't rely on typescript inference
// `addProjectionItem` will return `any` without this type definition

export interface ParsedSql {
  /**
   * Return the sql as a raw string.
   */
  toString(): string;

  /**
   * Concrete Syntax Tree.
   */
  cst: CstNode;

  /**
   * Returns `true` if the statement has a `FROM`.
   */
  hasFrom(): boolean;

  /**
   * Returns `true` if the `tablePrimary` is part of the query.
   *
   * @param name
   */
  hasTablePrimary(name: string): boolean;

  /**
   * Add a projectionItem to the query.
   *
   * @param projectionItem
   * @param options
   * @param options.removeAsterisk remove `*` from the original query (default: `true`)
   * @param options.escapeReservedKeywords Escape reserved keywords (default: `true`)
   */
  addProjectionItem(
    projectionItem: string,
    options?: { removeAsterisk?: boolean; escapeReservedKeywords?: boolean }
  ): ParsedSql;
}

/**
 * Parsed sql statement, with all utilities methods assigned.
 *
 * @param sql
 */
const parsedSql = (sql: string): ParsedSql => {
  const { cst, lexErrors, parseErrors } = parseSql(sql);

  if (lexErrors.length) {
    throw new Error(
      `Lexer error:\n - ${lexErrors.map(err => err.message).join("\n - ")}`
    );
  }

  if (parseErrors.length) {
    throw new Error(
      `Parse error:\n - ${parseErrors.map(err => err.message).join("\n - ")}`
    );
  }

  return {
    toString() {
      return sql;
    },

    cst,

    hasFrom() {
      const visitor = new HasFromVisitor();
      visitor.visit(cst);
      return visitor.hasFrom;
    },

    hasTablePrimary(name) {
      const visitor = new HasTablePrimary(name);
      visitor.visit(cst);
      return visitor.hasTablePrimary;
    },

    addProjectionItem(
      projectionItem,
      options = { removeAsterisk: true, escapeReservedKeywords: true }
    ) {
      const visitor = new ProjectionItemsVisitor();
      visitor.visit(cst);
      const lastProjectionItem = visitor.output[visitor.output.length - 1];

      const asteriskNode = visitor.output.find(node => node.image === "*");

      // escape reserved keywords
      if (
        options.escapeReservedKeywords &&
        reserved.includes(projectionItem.toUpperCase())
      ) {
        projectionItem = `"${projectionItem}"`;
      }

      // multiline query
      if (visitor.output.length > 1) {
        const previousProjectionItem =
          visitor.output[visitor.output.length - 2];
        const isMultiline =
          previousProjectionItem.endLine !== lastProjectionItem.endLine;

        if (isMultiline) {
          const spaces = " ".repeat((lastProjectionItem.startColumn || 1) - 1);

          let nextSql = insertText(sql, `,\n${spaces}${projectionItem}`, {
            line: (lastProjectionItem.endLine || 1) - 1,
            column: lastProjectionItem.endColumn || 0
          });

          if (options.removeAsterisk && asteriskNode) {
            nextSql = nextSql.replace("*,\n" + spaces, "");
          }
          return parsedSql(nextSql);
        }
      }

      // one line case insertion
      let nextSql = insertText(sql, `, ${projectionItem}`, {
        line: (lastProjectionItem.endLine || 1) - 1,
        column: lastProjectionItem.endColumn || 0
      });

      if (options.removeAsterisk && asteriskNode) {
        nextSql = nextSql.replace("*, ", "");
      }

      return parsedSql(nextSql);
    }
  };
};

export default rhombic;
