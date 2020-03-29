import { parser } from "../SqlParser";
import { FilterTree, Operator, isOperator } from "../FilterTree";
import {
  BooleanExpressionContext,
  BooleanExpressionValueContext
} from "../Context";
import { getImageFromChildren } from "../utils/getImageFromChildren";

const Visitor = parser.getBaseCstVisitorConstructorWithDefaults();

/**
 * Visitor to extract filter tree on the `WHERE` statement
 */
export class FilterTreeVisitor extends Visitor {
  public tree: FilterTree = [
    { type: "operator", closeParentheses: [], openParentheses: [] }
  ];

  private parenthesisCount = 0;
  private parenthesisToClose: number[] = [];

  private getOperator(expressionValue: BooleanExpressionValueContext) {
    if (expressionValue.BinaryOperator) {
      return expressionValue.BinaryOperator[0].image.toLowerCase() as Operator;
    }
    if (expressionValue.MultivalOperator) {
      return expressionValue.MultivalOperator[0].image.toLowerCase() as Operator;
    }
    if (expressionValue.IsNotNull) {
      return expressionValue.IsNotNull[0].image.toLowerCase() as Operator;
    }
    if (expressionValue.IsNull) {
      return expressionValue.IsNull[0].image.toLowerCase() as Operator;
    }

    return "="; // This is just to make typescript happy, this case is not possible with the actual grammar
  }

  private getValue(expressionValue: BooleanExpressionValueContext) {
    if (expressionValue.BinaryOperator) {
      return getImageFromChildren(expressionValue.valueExpression[0].children);
    }
    if (expressionValue.MultivalOperator) {
      return expressionValue.valueExpression
        .map(i => getImageFromChildren(i.children))
        .join(", ");
    }

    return undefined;
  }

  booleanExpression(ctx: BooleanExpressionContext) {
    if (ctx.LParen && ctx.RParen) {
      // Flag open parenthese
      const startOperatorNode = this.tree[this.tree.length - 1];
      if (isOperator(startOperatorNode)) {
        this.parenthesisToClose.push(this.parenthesisCount);
        startOperatorNode.openParentheses.unshift(this.parenthesisCount++);
      }

      // Visit inside
      this.booleanExpression(ctx.booleanExpression[0].children);

      // Flag close parenthese
      const endOperatorNode = this.tree[this.tree.length - 1];
      if (isOperator(endOperatorNode)) {
        endOperatorNode.closeParentheses.push(
          this.parenthesisToClose.shift() || 0
        );
      }
    }

    // Add predicate + operator on each value
    if (ctx.booleanExpressionValue) {
      ctx.booleanExpressionValue.forEach(predicate => {
        this.tree.push({
          type: "predicate",
          dimension: predicate.children.columnPrimary[0].children.Identifier.map(
            i => i.image
          ).join("."),
          operator: this.getOperator(predicate.children),
          value: this.getValue(predicate.children)
        });
        this.tree.push({
          type: "operator",
          openParentheses: [],
          closeParentheses: []
        });
      });
    }

    // Deal with `AND`/`OR`
    if (ctx.Or || ctx.And) {
      const lastOperatorNode = this.tree[this.tree.length - 1];
      if (isOperator(lastOperatorNode)) {
        lastOperatorNode.operator = ctx.Or ? "or" : "and";
      }
      // Visit alternative node
      this.booleanExpression(
        ctx.booleanExpression[ctx.booleanExpression.length - 1].children
      );
    }
  }
}
