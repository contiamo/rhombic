import { generateDefinitionTypes, Node } from "./generateContextTypes";

// Simplify version of `Node` for mocking purpose
interface NodeMock {
  type: string;
  name?: string;
  definition?: NodeMock[];
  separator?: {
    type: "Terminal";
    name: string;
  };
}

function mockDefinition(mock: NodeMock[]) {
  return mock as Node[];
}

describe("generateDefinitionTypes", () => {
  it("should generate proper types for 'cast'", () => {
    const definition = mockDefinition([
      {
        type: "Terminal",
        name: "Cast"
      },
      {
        type: "Terminal",
        name: "LParen"
      },
      {
        type: "NonTerminal",
        name: "expression"
      },
      {
        type: "Terminal",
        name: "As"
      },
      {
        type: "NonTerminal",
        name: "type"
      },
      {
        type: "Option",
        definition: [
          {
            type: "Terminal",
            name: "LParen"
          },
          {
            type: "Terminal",
            name: "IntegerValue"
          },
          {
            type: "Option",
            definition: [
              {
                type: "Terminal",
                name: "Comma"
              },
              {
                type: "Terminal",
                name: "IntegerValue"
              }
            ]
          },
          {
            type: "Terminal",
            name: "RParen"
          }
        ]
      },
      {
        type: "Terminal",
        name: "RParen"
      }
    ]);

    expect(generateDefinitionTypes(definition)).toMatchInlineSnapshot(`
                        "
                          Cast: IToken[];
                          LParen: IToken[];
                          expression: Array<{
                            name: \\"expression\\";
                            children: ExpressionContext;
                          }>;
                          As: IToken[];
                          type: Array<{
                            name: \\"type\\";
                            children: TypeContext;
                          }>;
                          IntegerValue?: IToken[];
                          Comma?: IToken[];
                          RParen: IToken[];"
                `);
  });

  it("should deal with options", () => {
    const definition = mockDefinition([
      {
        type: "NonTerminal",
        name: "select"
      },
      {
        type: "Option",
        definition: [
          {
            type: "NonTerminal",
            name: "orderBy"
          }
        ]
      },
      {
        type: "Option",
        definition: [
          {
            type: "Terminal",
            name: "Limit"
          },
          {
            type: "Alternation",
            definition: [
              {
                type: "Flat",
                definition: [
                  {
                    type: "Terminal",
                    name: "IntegerValue"
                  }
                ]
              },
              {
                type: "Flat",
                definition: [
                  {
                    type: "Terminal",
                    name: "All"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]);

    expect(generateDefinitionTypes(definition)).toMatchInlineSnapshot(`
            "
              select: Array<{
                name: \\"select\\";
                children: SelectContext;
              }>;
              orderBy?: Array<{
                name: \\"orderBy\\";
                children: OrderByContext;
              }>;
              Limit?: IToken[];
            IntegerValue?: IToken[];
            All?: IToken[];"
        `);
  });

  it("should deal with RepetitionMandatoryWithSeparator", () => {
    const definition = mockDefinition([
      {
        type: "Terminal",
        name: "OrderBy"
      },
      {
        type: "RepetitionMandatoryWithSeparator",
        separator: {
          type: "Terminal",
          name: "Comma"
        },
        definition: [
          {
            type: "NonTerminal",
            name: "orderItem"
          }
        ]
      }
    ]);

    expect(generateDefinitionTypes(definition)).toMatchInlineSnapshot(`
      "
        OrderBy: IToken[];
          orderItem: Array<{
            name: \\"orderItem\\";
            children: OrderItemContext;
          }>;
          Comma?: IToken[];"
    `);
  });
});
