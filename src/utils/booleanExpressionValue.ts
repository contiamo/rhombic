import {
  ColumnPrimaryContext,
  ValueExpressionContext,
  BooleanExpressionValueContext
} from "../Context";
import { IToken } from "chevrotain";

type BooleanExpressionValueContextWithColumnPrimary = BooleanExpressionValueContext & {
  columnPrimary: Array<{
    name: "columnPrimary";
    children: ColumnPrimaryContext;
  }>;
  BinaryOperator: IToken[];
  valueExpression: Array<{
    name: "valueExpression";
    children: ValueExpressionContext;
  }>;
};

type BinaryOperation = BooleanExpressionValueContext & {
  columnPrimary: Array<{
    name: "columnPrimary";
    children: ColumnPrimaryContext;
  }>;
  BinaryOperator: IToken[];
  valueExpression: Array<{
    name: "valueExpression";
    children: ValueExpressionContext;
  }>;
};

type MultivalOperation = BooleanExpressionValueContext & {
  MultivalOperator: IToken[];
  LParen: IToken[];
  valueExpression: Array<{
    name: "valueExpression";
    children: ValueExpressionContext;
  }>;
  Comma?: IToken[];
  RParen: IToken[];
};

type UnaryOperation = BooleanExpressionValueContext & {
  IsNull?: IToken[];
  IsNotNull?: IToken[];
};
/**
 * Type guard to discriminate if the value have columnPrimary.
 *
 * @param ctx BooleanExpressionValueContext
 */
export const hasColumnPrimary = (
  ctx: BooleanExpressionValueContext
): ctx is BooleanExpressionValueContextWithColumnPrimary =>
  Boolean((ctx as any).columnPrimary);

export const isBinaryOperation = (
  ctx: BooleanExpressionValueContext
): ctx is BinaryOperation => Boolean((ctx as any).BinaryOperator);

export const isMultivalOperation = (
  ctx: BooleanExpressionValueContext
): ctx is MultivalOperation => Boolean((ctx as any).MultivalOperator);

export const isUnaryOperation = (
  ctx: BooleanExpressionValueContext
): ctx is UnaryOperation =>
  Boolean((ctx as any).IsNull || (ctx as any).IsNotNull);
