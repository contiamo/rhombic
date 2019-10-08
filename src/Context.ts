// Auto-generated by generateContextTypes.ts
import { IToken } from "chevrotain";

export interface StatementContext {
  query: Array<{
    name: "query";
    children: QueryContext;
  }>;
}

export interface QueryContext {
  values: Array<{
    name: "values";
    children: ValuesContext;
  }>;
  select: Array<{
    name: "select";
    children: SelectContext;
  }>;
}

export interface ExpressionContext {
  Integer?: IToken[];
  String?: IToken[];
  Null?: IToken[];
  LParen?: IToken[];
  RParen?: IToken[];
  Identifier?: IToken[];
  FunctionIdentifier?: IToken[];
  expression: Array<{
    name: "expression";
    children: ExpressionContext;
  }>;
  cast: Array<{
    name: "cast";
    children: CastContext;
  }>;
}

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
  LParen?: IToken[];
  Integer?: IToken[];
  Comma?: IToken[];
  Integer?: IToken[];
  RParen?: IToken[];
  RParen: IToken[];
}

export interface TypeContext {
  SqlTypeName?: IToken[];
  CollectionTypeName?: IToken[];
}

export interface ValueExpressionContext {}

export interface OrderItemContext {}

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
  tableExpression: Array<{
    name: "tableExpression";
    children: TableExpressionContext;
  }>;
}

export interface ProjectionItemsContext {
  projectionItem: Array<{
    name: "projectionItem";
    children: ProjectionItemContext;
  }>;
  Comma?: IToken[];
}

export interface ProjectionItemContext {
  expression: Array<{
    name: "expression";
    children: ExpressionContext;
  }>;
  As?: IToken[];
  Identifier?: IToken[];
  Asterisk?: IToken[];
}

export interface TableExpressionContext {}

export interface JoinConditionContext {}

export interface TableReferenceContext {
  tablePrimary: Array<{
    name: "tablePrimary";
    children: TablePrimaryContext;
  }>;
}

export interface TablePrimaryContext {
  Identifier?: IToken[];
  Period?: IToken[];
}

export interface ColumnDeclContext {}

export interface ValuesContext {
  Values: IToken[];
}

export interface GroupItemContext {}

export interface WindowContext {}

export interface WindowSpecContext {}
