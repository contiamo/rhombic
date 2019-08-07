import { parseSql } from "./SqlParser";
import { HasFromVisitor } from "./visitors/HasFromVisitor";
import { ProjectItemsVisitor } from "./visitors/ProjectItemsVisitor";
import { insertText } from "./utils/insertText";

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

/**
 * Parsed sql statement, with all utilities methods assigned.
 *
 * @param sql
 */
const parsedSql = (sql: string) => {
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
    /**
     * Return the sql as a raw string.
     */
    toString() {
      return sql;
    },

    /**
     * Concrete Syntax Tree
     */
    cst,

    /**
     * Returns `true` if the statement has a `FROM`
     */
    hasFrom() {
      const visitor = new HasFromVisitor();
      visitor.visit(cst);
      return visitor.hasFrom;
    },

    /**
     * Add a projectItem to the query.
     *
     * @param projectItem
     */
    addProjectItem(projectItem: string) {
      const visitor = new ProjectItemsVisitor();
      visitor.visit(cst);
      const lastProjectItem = visitor.output[visitor.output.length - 1];

      if (visitor.output.length > 1) {
        const previousProjectItem = visitor.output[visitor.output.length - 2];
        const isMultiline =
          previousProjectItem.endLine !== lastProjectItem.endLine;

        if (isMultiline) {
          return parsedSql(
            insertText(
              sql,
              `,\n${" ".repeat(
                (lastProjectItem.startColumn || 1) - 1
              )}${projectItem}`,
              {
                line: (lastProjectItem.endLine || 1) - 1,
                column: lastProjectItem.endColumn || 0
              }
            )
          );
        }
      }

      // one line case insertion
      return parsedSql(
        insertText(sql, `, ${projectItem}`, {
          line: (lastProjectItem.endLine || 1) - 1,
          column: lastProjectItem.endColumn || 0
        })
      );
    }
  };
};

export default rhombic;
