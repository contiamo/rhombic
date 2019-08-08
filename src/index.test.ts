import rhombic from "./";

describe("rhombic", () => {
  describe("errors", () => {
    it("should throw on bad sql", () => {
      expect(() => rhombic.parse("I'm not a sql statement")).toThrowError(
        `Lexer error:\n - unexpected character: ->'<- at offset: 1, skipped 1 characters.`
      );
    });
  });

  describe("hasFrom", () => {
    it("should return true if the statement has FROM", () => {
      const hasFrom = rhombic.parse("SELECT * FROM my_table").hasFrom();

      expect(hasFrom).toBe(true);
    });
    it("should return false if the statement doesn't have FROM", () => {
      const hasFrom = rhombic.parse("SELECT 'hello'").hasFrom();

      expect(hasFrom).toBe(false);
    });
    it("should return false if the statement doesn't have FROM (sneaky case)", () => {
      const hasFrom = rhombic.parse("SELECT 'from hello'").hasFrom();

      expect(hasFrom).toBe(false);
    });
  });

  describe("addProjectItem", () => {
    it("should add `column02` to the project items", () => {
      const query = rhombic
        .parse("SELECT column01 FROM my_table")
        .addProjectItem("column02")
        .toString();

      expect(query).toEqual("SELECT column01, column02 FROM my_table");
    });
    it("should add `column03` to the project items", () => {
      const query = rhombic
        .parse("SELECT column01, column02 FROM my_table")
        .addProjectItem("column03")
        .toString();

      expect(query).toEqual(
        "SELECT column01, column02, column03 FROM my_table"
      );
    });
    it("should add `column03` to the project items (integer)", () => {
      const query = rhombic
        .parse("SELECT 2, 3 FROM my_table")
        .addProjectItem("column03")
        .toString();

      expect(query).toEqual("SELECT 2, 3, column03 FROM my_table");
    });
    it("should add `column03` to the project items (asterisk)", () => {
      const query = rhombic
        .parse("SELECT * FROM my_table")
        .addProjectItem("column03")
        .toString();

      expect(query).toEqual("SELECT *, column03 FROM my_table");
    });
    it("should deal with a multiline statement", () => {
      const query = rhombic
        .parse(
          `
        SELECT
          column01,
          column02
        FROM my_table`
        )
        .addProjectItem("column03")
        .toString();

      expect(query).toEqual(
        `
        SELECT
          column01,
          column02,
          column03
        FROM my_table`
      );
    });
  });
});
