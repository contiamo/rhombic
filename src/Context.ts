// Auto-generated by generateContextTypes.ts
import { IToken } from "chevrotain";

export interface StatementContext {
  query: Array<{
    name: "query";
    children: QueryContext;
  }>;
}

export type QueryContext =
  | {
      values: Array<{
        name: "values";
        children: ValuesContext;
      }>;
    }
  | {
      select: Array<{
        name: "select";
        children: SelectContext;
      }>;
      orderBy?: Array<{
        name: "orderBy";
        children: OrderByContext;
      }>;
      Limit?: IToken[];
      IntegerValue?: IToken[];
      All?: IToken[];
    };

export type ExpressionContext =
  | {
      IntegerValue: IToken[];
    }
  | { StringValue: IToken[] }
  | { Null: IToken[] }
  | { LParen: IToken[]; RParen: IToken[] }
  | {
      columnPrimary: Array<{
        name: "columnPrimary";
        children: ColumnPrimaryContext;
      }>;
    }
  | {
      FunctionIdentifier: IToken[];
      LParen: IToken[];
      expression: Array<{
        name: "expression";
        children: ExpressionContext;
      }>;
      RParen: IToken[];
    }
  | {
      cast: Array<{
        name: "cast";
        children: CastContext;
      }>;
    };

export interface CastContext {
  Cast: IToken[];
  LParen: IToken[];
  expression: Array<{
    name: "expression";
    children: ExpressionContext;
  }>;
  As: IToken[];
  type: Array<{
    name: "type";
    children: TypeContext;
  }>;
  IntegerValue?: IToken[];
  Comma?: IToken[];
  RParen: IToken[];
}

export interface OrderByContext {
  OrderBy: IToken[];
  orderItem: Array<{
    name: "orderItem";
    children: OrderItemContext;
  }>;
  Comma?: IToken[];
}

export interface TypeContext {
  SqlTypeName?: IToken[];
  CollectionTypeName?: IToken[];
}

export interface ValueExpressionContext {
  IntegerValue?: IToken[];
  StringValue?: IToken[];
  BooleanValue?: IToken[];
  DateValue?: IToken[];
}

export type BooleanExpressionContext = (
  | {
      LParen: IToken[];
      booleanExpression: Array<{
        name: "booleanExpression";
        children: BooleanExpressionContext;
      }>;
      RParen: IToken[];
    }
  | {
      booleanExpressionValue: Array<{
        name: "booleanExpressionValue";
        children: BooleanExpressionValueContext;
      }>;
    }) & {
  Or?: IToken[];
  And?: IToken[];
  booleanExpression?: Array<{
    name: "booleanExpression";
    children: BooleanExpressionContext;
  }>;
};

export type BooleanExpressionValueContext =
  | {
      columnPrimary: Array<{
        name: "columnPrimary";
        children: ColumnPrimaryContext;
      }>;
      BinaryOperator: IToken[];
      valueExpression: Array<{
        name: "valueExpression";
        children: ValueExpressionContext;
      }>;
    }
  | {
      columnPrimary: Array<{
        name: "columnPrimary";
        children: ColumnPrimaryContext;
      }>;
    }
  | {
      MultivalOperator: IToken[];
      LParen: IToken[];
      valueExpression: Array<{
        name: "valueExpression";
        children: ValueExpressionContext;
      }>;
    }
  | {
      columnPrimary: Array<{
        name: "columnPrimary";
        children: ColumnPrimaryContext;
      }>;
      Comma?: IToken[];
      RParen: IToken[];
    }
  | { IsNull?: IToken[]; IsNotNull?: IToken[] };

export interface OrderItemContext {
  expression: Array<{
    name: "expression";
    children: ExpressionContext;
  }>;
  Asc?: IToken[];
  Desc?: IToken[];
  Nulls?: IToken[];
  First?: IToken[];
  Last?: IToken[];
}

export interface SelectContext {
  Select: IToken[];
  Stream?: IToken[];
  All?: IToken[];
  Distinct?: IToken[];
  projectionItems: Array<{
    name: "projectionItems";
    children: ProjectionItemsContext;
  }>;
  From?: IToken[];
  tableExpression?: Array<{
    name: "tableExpression";
    children: TableExpressionContext;
  }>;
  where?: Array<{
    name: "where";
    children: WhereContext;
  }>;
}

export interface WhereContext {
  Where: IToken[];
  booleanExpression: Array<{
    name: "booleanExpression";
    children: BooleanExpressionContext;
  }>;
}

export interface ProjectionItemsContext {
  projectionItem: Array<{
    name: "projectionItem";
    children: ProjectionItemContext;
  }>;
  Comma?: IToken[];
}

export type ProjectionItemContext =
  | {
      Identifier?: IToken[];
      Period?: IToken[];
      Asterisk: IToken[];
    }
  | {
      expression: Array<{
        name: "expression";
        children: ExpressionContext;
      }>;
      As?: IToken[];
      Identifier?: IToken[];
    };

export type TableExpressionContext =
  | {
      Natural?: IToken[];
      Inner?: IToken[];
      Left?: IToken[];
      Right?: IToken[];
      Full?: IToken[];
      Outer?: IToken[];
      Join: IToken[];
      tableExpression: Array<{
        name: "tableExpression";
        children: TableExpressionContext;
      }>;
      joinCondition?: Array<{
        name: "joinCondition";
        children: JoinConditionContext;
      }>;
    }
  | {
      Cross: IToken[];
      Join: IToken[];
      tableExpression: Array<{
        name: "tableExpression";
        children: TableExpressionContext;
      }>;
    }
  | {
      Cross?: IToken[];
      Outer?: IToken[];
      Apply: IToken[];
      tableExpression: Array<{
        name: "tableExpression";
        children: TableExpressionContext;
      }>;
    };

export type JoinConditionContext =
  | {
      On: IToken[];
      booleanExpression: Array<{
        name: "booleanExpression";
        children: BooleanExpressionContext;
      }>;
    }
  | {
      Using: IToken[];
      LParen: IToken[];
      projectionItems: Array<{
        name: "projectionItems";
        children: ProjectionItemsContext;
      }>;
      RParen: IToken[];
    };

export interface TableReferenceContext {
  tablePrimary: Array<{
    name: "tablePrimary";
    children: TablePrimaryContext;
  }>;
  As?: IToken[];
  Identifier?: IToken[];
  LParen?: IToken[];
  Comma?: IToken[];
  RParen?: IToken[];
}

export interface TablePrimaryContext {
  Identifier?: IToken[];
  Period?: IToken[];
}

export interface ColumnPrimaryContext {
  Identifier: IToken[];
  Period?: IToken[];
}

export interface ColumnDeclContext {}

export interface ValuesContext {
  Values: IToken[];
  expression: Array<{
    name: "expression";
    children: ExpressionContext;
  }>;
  Comma?: IToken[];
}

export interface GroupItemContext {}

export interface WindowContext {}

export interface WindowSpecContext {}

export type IContext =
  | StatementContext
  | QueryContext
  | ExpressionContext
  | CastContext
  | OrderByContext
  | TypeContext
  | ValueExpressionContext
  | BooleanExpressionContext
  | BooleanExpressionValueContext
  | OrderItemContext
  | SelectContext
  | WhereContext
  | ProjectionItemsContext
  | ProjectionItemContext
  | TableExpressionContext
  | JoinConditionContext
  | TableReferenceContext
  | TablePrimaryContext
  | ColumnPrimaryContext
  | ColumnDeclContext
  | ValuesContext
  | GroupItemContext
  | WindowContext
  | WindowSpecContext;
