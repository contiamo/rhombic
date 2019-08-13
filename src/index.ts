import { parseSql } from "./SqlParser";
import { HasFromVisitor } from "./visitors/HasFromVisitor";
import { ProjectItemsVisitor } from "./visitors/ProjectItemsVisitor";
import { insertText } from "./utils/insertText";
import { CstNode } from "chevrotain";
import { HasTablePrimary } from "./visitors/HasTablePrimaryVisitor";

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
// `addProjectItem` will return `any` without this type definition

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
   * Add a projectItem to the query.
   *
   * @param projectItem
   * @param options
   * @param options.autoRemoveAsterisk remove `*` from the original query (default: `true`)
   */
  addProjectItem(
    projectItem: string,
    options?: { autoRemoveAsterisk: boolean }
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

    addProjectItem(projectItem, options = { autoRemoveAsterisk: true }) {
      const visitor = new ProjectItemsVisitor();
      visitor.visit(cst);
      const lastProjectItem = visitor.output[visitor.output.length - 1];
      const asteriskNode = visitor.output.find(node => node.image === "*");

      if (visitor.output.length > 1) {
        const previousProjectItem = visitor.output[visitor.output.length - 2];
        const isMultiline =
          previousProjectItem.endLine !== lastProjectItem.endLine;

        if (isMultiline) {
          const spaces = " ".repeat((lastProjectItem.startColumn || 1) - 1);

          let nextSql = insertText(sql, `,\n${spaces}${projectItem}`, {
            line: (lastProjectItem.endLine || 1) - 1,
            column: lastProjectItem.endColumn || 0
          });

          if (options.autoRemoveAsterisk && asteriskNode) {
            nextSql = nextSql.replace("*,\n" + spaces, "");
          }
          return parsedSql(nextSql);
        }
      }

      // one line case insertion
      let nextSql = insertText(sql, `, ${projectItem}`, {
        line: (lastProjectItem.endLine || 1) - 1,
        column: lastProjectItem.endColumn || 0
      });

      if (options.autoRemoveAsterisk && asteriskNode) {
        nextSql = nextSql.replace("*, ", "");
      }

      return parsedSql(nextSql);
    }
  };
};

export default rhombic;
