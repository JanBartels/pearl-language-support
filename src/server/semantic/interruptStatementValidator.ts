// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { InterruptStatementNode } from '../ast/problem/statements/interruptStatementNode';
import type { Environment } from './environment';
import { SemanticDiagnosticCode } from './semanticDiagnostic';
import { validateInterruptOperand } from './interruptOperandValidator';
import type { InterruptOperandValidationContext } from './interruptOperandValidator';

/** Validates the three interrupt control statements independently of the LSP. */
export class InterruptStatementValidator {
    validate(
        node: InterruptStatementNode,
        environment: Environment,
        state: InterruptOperandValidationContext
    ): void {
        if (!node.interrupt) return; // Missing operands are syntax errors.
        validateInterruptOperand(node.interrupt, node.keyword.value,
            SemanticDiagnosticCode.InvalidInterruptOperand, environment, state);
    }
}
