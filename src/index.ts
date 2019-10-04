import { parseSql } from "./SqlParser";
import { HasFromVisitor } from "./visitors/HasFromVisitor";
import { ProjectionItemsVisitor } from "./visitors/ProjectionItemsVisitor";
import { insertText } from "./utils/insertText";
import { CstNode } from "chevrotain";
import { HasTablePrimary } from "./visitors/HasTablePrimaryVisitor";
import { reserved } from "./reserved";
import { replaceText } from "./utils/replaceText";
import { getLocation } from "./utils/getLocation";

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
   * Get a projectionItem from result index.
   *
   * @param options
   * @param options.columns Query columns results, needed to be able to expands `*`
   * @param options.index Index of the `projectionItem` to rename
   */
  getProjectionItem(options: {
    columns: string[];
    index: number;
  }): { expression: string; alias?: string };

  /**
   * Add a projectionItem to the query.
   *
   * @param projectionItem
   * @param options
   * @param options.removeAsterisk Remove `*` from the original query (default: `true`)
   * @param options.escapeReservedKeywords Escape reserved keywords (default: `true`)
   */
  addProjectionItem(
    projectionItem: string,
    options?: { removeAsterisk?: boolean; escapeReservedKeywords?: boolean }
  ): ParsedSql;

  /**
   * Update a projectionItem.
   *
   * @param options
   * @param options.columns Query columns results, needed to be able to expands `*`
   * @param options.index Index of the `projectionItem` to rename
   * @param options.value Replace value for the `projectionItem`
   */
  updateProjectionItem(options: {
    columns: string[];
    index: number;
    value: string;
  }): ParsedSql;
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

    getProjectionItem({ columns, index }) {
      const visitor = new ProjectionItemsVisitor();
      visitor.visit(cst);
      const projectionItems = visitor.output;

      if (visitor.asteriskCount > 0) {
        // Projection not in asterisk
        if (projectionItems[index] && !projectionItems[index].isAsterisk) {
          return {
            expression: projectionItems[index].expression,
            alias: projectionItems[index].alias
          };
        }

        // Check for duplicate projection names
        const value = columns[index];
        const otherNames = projectionItems.reduce(
          (mem, i) => {
            if (i.isAsterisk) return mem;
            return [...mem, i.alias || i.expression];
          },
          [] as string[]
        );
        const candidates = otherNames
          .filter(i => value.startsWith(i))
          .sort((a, b) => b.length - a.length);
        const originalValue = candidates[0];
        return {
          expression: originalValue || value
        };
      } else {
        return {
          expression: projectionItems[index].expression,
          alias: projectionItems[index].alias
        };
      }
    },

    addProjectionItem(projectionItem, options) {
      // Default options
      options = {
        removeAsterisk: true,
        escapeReservedKeywords: true,
        ...options
      };

      const visitor = new ProjectionItemsVisitor();
      visitor.visit(cst);
      const lastProjectionItem = visitor.output[visitor.output.length - 1];

      const hasAsterisk = visitor.asteriskCount;

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
            line: lastProjectionItem.endLine || 1,
            column: lastProjectionItem.endColumn || 0
          });

          if (options.removeAsterisk && hasAsterisk) {
            nextSql = nextSql.replace("*,\n" + spaces, "");
          }
          return parsedSql(nextSql);
        }
      }

      // one line case insertion
      let nextSql = insertText(sql, `, ${projectionItem}`, {
        line: lastProjectionItem.endLine || 1,
        column: lastProjectionItem.endColumn || 0
      });

      if (options.removeAsterisk && hasAsterisk) {
        nextSql = nextSql.replace("*, ", "");
      }

      return parsedSql(nextSql);
    },

    updateProjectionItem({ index, value, columns }) {
      const visitor = new ProjectionItemsVisitor();
      visitor.visit(cst);
      const projectionItems = visitor.output;

      if (visitor.asteriskCount > 0) {
        // Expand asterisk
        const nonAsteriskItemsCount = projectionItems.filter(i => !i.isAsterisk)
          .length;
        const projectionItemsBehindAsterisk =
          (columns.length - nonAsteriskItemsCount) / visitor.asteriskCount;
        const asteriskIndex = projectionItems.findIndex(t => t.isAsterisk) || 0;

        const nextSql = replaceText(
          sql,
          columns
            .slice(asteriskIndex, asteriskIndex + projectionItemsBehindAsterisk)
            .map((c, i) => (i + asteriskIndex === index ? value : c))
            .join(", "),
          getLocation(projectionItems[asteriskIndex])
        );

        return parsedSql(nextSql);
      } else {
        const targetNode = projectionItems[index];
        const nextSql = replaceText(sql, value, getLocation(targetNode));
        return parsedSql(nextSql);
      }
    }
  };
};

export default rhombic;
