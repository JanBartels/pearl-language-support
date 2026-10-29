// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { AssignmentDocumentationProvider }
    from '../../../documentation/problem/statements/assignmentDocumentationProvider';
import { NameExpressionNode } from '../expressions/nameExpressionNode';
import { ExpressionNode } from '../expressions/expressionNode';

/** Name (':=' | '=') Expression ';'. Syntax only: writability and types belong to semantics. */
export class AssignmentNode extends AstNode {
    private static readonly provider = new AssignmentDocumentationProvider();

    constructor(
        public readonly target: NameExpressionNode,
        public readonly operator: SourceValue<string>,
        public readonly expression: ExpressionNode | undefined,
        public readonly semicolon: SourceValue<string> | undefined,
        /** RTOS-UH: explicitly dereference the assignment destination. */
        public readonly contOperator?: SourceValue<string>
    ) {
        super(AstKind.Assignment);
        this.adopt(target);
        if (expression) this.adopt(expression);
    }

    override documentationProvider(): DocumentationProvider<AssignmentNode> {
        return AssignmentNode.provider;
    }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        return this.lookupOwnSourceValue(position, this.contOperator)
            ?? this.target.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.operator)
            ?? this.expression?.lookupSourceValue(position)
            ?? this.lookupOwnSourceValue(position, this.semicolon);
    }

    override getChildren(): readonly AstNode[] {
        return this.expression ? [this.target, this.expression] : [this.target];
    }

    override dumpLabel(): string {
        return `Assignment(${this.contOperator ? 'CONT ' : ''}${this.operator.value})`;
    }
}
