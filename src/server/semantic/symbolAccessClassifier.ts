// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { AstNode } from '../ast/astNode';
import { NameExpressionNode } from '../ast/problem/expressions/nameExpressionNode';
import { NameArgumentListNode } from '../ast/problem/expressions/nameArgumentListNode';
import { NameSegmentNode } from '../ast/problem/expressions/nameSegmentNode';
import { AssignmentNode } from '../ast/problem/statements/assignmentNode';
import { ActualParameterNode } from '../ast/problem/statements/actualParameterNode';
import { ActualParameterListNode } from '../ast/problem/statements/actualParameterListNode';
import { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import { BasicTransferStatementNode } from '../ast/problem/statements/basicTransferStatementNode';
import { BinaryTransferStatementNode } from '../ast/problem/statements/binaryTransferStatementNode';
import { BinaryTransferSFormatNode } from '../ast/problem/statements/binaryTransferSFormatNode';
import { FormattedIoStatementNode } from '../ast/problem/statements/formattedIoStatementNode';
import { FormatItemNode } from '../ast/problem/statements/formatItemNode';
import { IoSegmentNode } from '../ast/problem/statements/ioSegmentNode';
import { ReturnStatementNode } from '../ast/problem/statements/returnStatementNode';
import { ProcedureDeclarationNode } from '../ast/problem/declarations/procedureDeclarationNode';
import { InitElementNode } from '../ast/problem/declarations/initElementNode';
import { InitializationAttributeNode } from '../ast/problem/declarations/initializationAttributeNode';
import { ProblemDataAttributeNode } from '../ast/problem/declarations/problemDataAttributeNode';
import { DclDeclarationSentenceNode } from '../ast/problem/declarations/dclDeclarationSentenceNode';
import type { SourceValue } from '../core/sourceValue';
import type { BuiltinDefinition } from './builtins/builtinSignature';
import { SemanticInitialValueKind } from './semanticConstantValue';
import type { SemanticContext } from './semanticContext';
import { SemanticTypeKind, type ProcedureParameterType, type ProcedureType, type SemanticType } from './semanticType';
import type { SemanticSymbol } from './symbol';
import { SymbolKind } from './symbolKind';
import { SymbolReferenceKind } from './symbolReference';
import type { SymbolReferenceResolution } from './symbolReferenceResolution';
import { SymbolAccessKind } from './symbolUsageIndex';

/**
 * Classifies already RESOLVED references from their existing AST context.
 * No lexical name lookup, token inspection, control-flow analysis or LSP
 * knowledge belongs here. Ambiguous indirect accesses suppress the more
 * specific read-only/write-only warnings via Address/Unknown.
 */
export class SymbolAccessClassifier {
    constructor(private readonly semantic: SemanticContext) {}

    classify(resolution: Extract<SymbolReferenceResolution, { kind: 'bound' }>): SymbolAccessKind {
        const { reference, symbol } = resolution;
        switch (reference.kind) {
            case SymbolReferenceKind.Read:
            case SymbolReferenceKind.Write:
                if (reference.node instanceof NameSegmentNode) {
                    return this.classifyName(reference.node, symbol);
                }
                return reference.kind === SymbolReferenceKind.Write
                    ? SymbolAccessKind.Write : SymbolAccessKind.Read;
            case SymbolReferenceKind.Initialization:
                // INIT(identifier) can denote a constant value or a REF
                // target. Inspect the RESOLVED initializer kind, not the
                // spelling of the declared type or of the identifier.
                if (this.referenceInitializer(reference.node)) return SymbolAccessKind.Address;
                return symbol.kind === SymbolKind.DataObject
                    && this.semantic.namedConstantValues.has(symbol)
                    ? SymbolAccessKind.Read : SymbolAccessKind.Unknown;
            case SymbolReferenceKind.Call:
                return SymbolAccessKind.Read; // A callable REF reads the pointer value.
            case SymbolReferenceKind.Type:
            case SymbolReferenceKind.Format:
            case SymbolReferenceKind.JumpTarget:
            case SymbolReferenceKind.DationCreationSource:
            case SymbolReferenceKind.ShellEntryPoint:
            case SymbolReferenceKind.BlockEnd:
            case SymbolReferenceKind.RepetitionEnd:
                return SymbolAccessKind.Unknown;
        }
    }

    private referenceInitializer(node: AstNode): boolean {
        if (!(node instanceof InitElementNode)) return false;
        const initialization = node.parent;
        const attribute = initialization instanceof InitializationAttributeNode
            ? initialization.parent : undefined;
        const sentence = attribute instanceof ProblemDataAttributeNode
            ? attribute.parent : undefined;
        if (!(sentence instanceof DclDeclarationSentenceNode)) return false;
        return sentence.identifiers.identifiers.some(identifier => {
            const symbol = this.semantic.bindings.get(identifier);
            return symbol?.kind === SymbolKind.DataObject
                && this.semantic.initialValues.get(symbol)?.kind === SemanticInitialValueKind.Reference;
        });
    }

    private classifyName(segment: NameSegmentNode, symbol: SemanticSymbol): SymbolAccessKind {
        const expression = segment.parent;
        if (!(expression instanceof NameExpressionNode)) return SymbolAccessKind.Unknown;
        const context = expression.parent;

        if (context instanceof AssignmentNode && context.target === expression) {
            // CONT R := ... changes the referenced object, not the pointer R.
            return context.contOperator ? SymbolAccessKind.Read : SymbolAccessKind.Write;
        }

        if (context instanceof AssignmentNode && context.expression === expression) {
            return this.referenceTransfer(context.target, expression)
                ? SymbolAccessKind.Address : SymbolAccessKind.Read;
        }

        if (context instanceof BasicTransferStatementNode && context.objects.includes(expression)) {
            return context.keyword.value === 'TAKE' ? SymbolAccessKind.Write : SymbolAccessKind.Read;
        }
        if (context instanceof BinaryTransferStatementNode && context.objects.includes(expression)) {
            return context.keyword.value === 'READ' ? SymbolAccessKind.Write : SymbolAccessKind.Read;
        }
        if (context instanceof FormattedIoStatementNode) {
            if (context.objects.includes(expression)) {
                return this.formattedInput(context) ? SymbolAccessKind.Write : SymbolAccessKind.Read;
            }
            if (context.target === expression && context.keyword.value === 'CONVERT') {
                return this.formattedInput(context) ? SymbolAccessKind.Read : SymbolAccessKind.Write;
            }
        }
        if (context instanceof IoSegmentNode && context.array === expression) {
            const enclosing = context.parent;
            if (enclosing instanceof FormattedIoStatementNode && enclosing.objects.includes(context)) {
                return this.formattedInput(enclosing) ? SymbolAccessKind.Write : SymbolAccessKind.Read;
            }
            return SymbolAccessKind.Unknown;
        }
        if (context instanceof FormatItemNode && context.argumentsList.includes(expression)
            && context.keyword?.value === 'RST') {
            return SymbolAccessKind.Write;
        }
        if (context instanceof BinaryTransferSFormatNode && context.variable === expression) {
            // S(n) can consume a maximum size and return an actual length.
            return SymbolAccessKind.Unknown;
        }
        if (context instanceof ActualParameterNode && context.expression === expression) {
            return this.callParameter(context, symbol);
        }
        if (context instanceof NameArgumentListNode && context.expressions.includes(expression)) {
            return this.expressionParameter(context, expression, symbol);
        }
        if (context instanceof ReturnStatementNode && context.expression === expression) {
            return this.returnedReference(context, symbol)
                ? SymbolAccessKind.Address : SymbolAccessKind.Read;
        }
        return SymbolAccessKind.Read;
    }

    private formattedInput(node: FormattedIoStatementNode): boolean {
        return node.keyword.value === 'GET'
            || (node.keyword.value === 'CONVERT' && node.directionKeyword?.value === 'FROM');
    }

    private callParameter(parameter: ActualParameterNode, symbol: SemanticSymbol): SymbolAccessKind {
        const list = parameter.parent;
        if (!(list instanceof ActualParameterListNode)) return SymbolAccessKind.Unknown;
        const call = list.parent;
        if (!(call instanceof CallStatementNode) || !call.target) return SymbolAccessKind.Unknown;
        const index = list.parameters.indexOf(parameter);
        const signature = this.procedureSignature(this.semantic.bindings.get(call.target));
        const formal = signature?.parameters[index];
        if (formal?.byIdentification || this.referenceFormalForValue(formal, symbol)) {
            return SymbolAccessKind.Address;
        }
        if (!signature && this.builtinIdentifies(this.semantic.builtinBindings.get(call.target), index)) {
            return SymbolAccessKind.Address;
        }
        // An unresolved or invalid call does not justify a read/write warning.
        if (!signature && !this.semantic.builtinBindings.has(call.target)) return SymbolAccessKind.Unknown;
        return SymbolAccessKind.Read;
    }

    private expressionParameter(
        list: NameArgumentListNode, expression: NameExpressionNode, symbol: SemanticSymbol
    ): SymbolAccessKind {
        const segment = list.parent;
        if (!(segment instanceof NameSegmentNode)) return SymbolAccessKind.Read;
        const index = list.expressions.indexOf(expression);
        const signature = this.procedureSignature(this.semantic.bindings.get(segment.identifier));
        const formal = signature?.parameters[index];
        if (formal?.byIdentification || this.referenceFormalForValue(formal, symbol)) {
            return SymbolAccessKind.Address;
        }
        if (this.builtinIdentifies(this.semantic.builtinBindings.get(segment.identifier), index)) {
            return SymbolAccessKind.Address;
        }
        return SymbolAccessKind.Read; // Otherwise this may be an array index.
    }

    private builtinIdentifies(builtin: BuiltinDefinition | undefined, index: number): boolean {
        return builtin?.signatures.some(signature =>
            (signature.parameters[index] ?? signature.repeatedParameter)?.byIdentification === true) ?? false;
    }

    private procedureSignature(symbol: SemanticSymbol | undefined): ProcedureType | undefined {
        if (symbol?.kind === SymbolKind.Procedure) return symbol.signature;
        if (symbol?.kind !== SymbolKind.DataObject && symbol?.kind !== SymbolKind.Parameter
            && symbol?.kind !== SymbolKind.Identification) return undefined;
        const type = symbol.type && this.underlying(symbol.type);
        if (type?.kind !== SemanticTypeKind.Reference) return undefined;
        const target = this.underlying(type.target);
        return target?.kind === SemanticTypeKind.Procedure ? target : undefined;
    }

    private referenceFormalForValue(
        formal: ProcedureParameterType | undefined, actual: SemanticSymbol
    ): boolean {
        if (!formal || formal.byIdentification) return false;
        const type = formal.type && this.underlying(formal.type);
        if (type?.kind !== SemanticTypeKind.Reference && type?.kind !== SemanticTypeKind.VoidReference) return false;
        return !this.isReference(actual);
    }

    private referenceTransfer(target: NameExpressionNode, value: NameExpressionNode): boolean {
        const targetSymbol = target.segments[0]
            ? this.semantic.bindings.get(target.segments[0].identifier) : undefined;
        const sourceSymbol = value.segments[0]
            ? this.semantic.bindings.get(value.segments[0].identifier) : undefined;
        return this.isReference(targetSymbol) && !this.isReference(sourceSymbol);
    }

    private returnedReference(node: ReturnStatementNode, symbol: SemanticSymbol): boolean {
        let ancestor: AstNode | undefined = node.parent;
        while (ancestor && !(ancestor instanceof ProcedureDeclarationNode)) {
            ancestor = ancestor.parent;
        }
        if (!(ancestor instanceof ProcedureDeclarationNode)) return false;
        const procedure = this.semantic.bindings.get(ancestor.name);
        const result = procedure?.kind === SymbolKind.Procedure
            ? procedure.signature?.resultType : undefined;
        const type = result && this.underlying(result);
        return (type?.kind === SemanticTypeKind.Reference || type?.kind === SemanticTypeKind.VoidReference)
            && !this.isReference(symbol);
    }

    private isReference(symbol: SemanticSymbol | undefined): boolean {
        if (!symbol || !('type' in symbol)) return false;
        const type = symbol.type && this.underlying(symbol.type);
        return type?.kind === SemanticTypeKind.Reference || type?.kind === SemanticTypeKind.VoidReference;
    }

    private underlying(type: SemanticType, visited = new Set<object>()): SemanticType | undefined {
        if (type.kind !== SemanticTypeKind.Named) return type;
        if (visited.has(type.symbol)) return undefined;
        visited.add(type.symbol);
        const definition = this.semantic.typeDefinitions.get(type.symbol);
        return definition ? this.underlying(definition, visited) : undefined;
    }
}
