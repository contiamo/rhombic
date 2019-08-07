import { parseSql } from "./SqlParser";
import { AstVisitor } from "./AstVisitor";

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
     * Concrete Abstract Tree
     */
    cst,

    /**
     * Returns `true` if the statement has a `FROM`
     */
    hasFrom() {
      const visitor = new AstVisitor();
      visitor.visit(cst);
      return visitor.hasFrom;
    }
  };
};

export default rhombic;
