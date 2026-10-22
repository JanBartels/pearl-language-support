// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import { AstKind } from '../ast/astKind';
import type { ModuleNode } from '../ast/module/moduleNode';
import type { ShellCommandNode } from '../ast/module/shellCommandNode';
import type { ProcedureDeclarationNode } from '../ast/problem/declarations/procedureDeclarationNode';
import type { ProcedureSymbol } from './symbol';
import { SemanticTypeKind } from './semanticType';
import type { ProcedureType, SemanticType } from './semanticType';
import { semanticTypeEquals } from './semanticTypeComparison';
import {
    SemanticDiagnosticCode,
    SemanticDiagnosticSeverity
} from './semanticDiagnostic';
import type { SemanticDiagnostic } from './semanticDiagnostic';

/** The shell ABI is fixed by RTOS-UH 3.3 (figure 3.3, p. 71).
 * The SHELLMODULE header contains names and command mappings, NOT type lists.
 * A local PROC definition must provide the five ABI parameters and BIT(1) result.
 */
export interface ShellProcedureValidation {
    readonly diagnostics: readonly SemanticDiagnostic[];
    readonly bindings: ReadonlyMap<SourceValue<string>, ProcedureSymbol>;
    readonly commandsByProcedure: ReadonlyMap<ProcedureDeclarationNode, ShellCommandNode>;
}

function checkShellSignature(signature: ProcedureType | undefined): boolean {
    if (!signature || signature.callingConvention !== 'PEARL'
        || signature.parameters.length !== 5 || !signature.hasResult) {
        return false;
    }

    const parameters = signature.parameters;
    for (let index = 0; index < 3; index++) {
        const parameter = parameters[index];
        if (!parameter.byIdentification || parameter.type?.kind !== SemanticTypeKind.Dation
            || parameter.type.dationClass !== 'ALPHIC') {
            return false;
        }
        // RTOS-UH explicitly allows individual directions for the three DATIONs.
        if (parameter.type.direction !== 'IN' && parameter.type.direction !== 'OUT'
            && parameter.type.direction !== 'INOUT') {
            return false;
        }
    }

    const length = parameters[3];
    const text = parameters[4];
    if (length.byIdentification || !length.type
        || !semanticTypeEquals(length.type, { kind: SemanticTypeKind.Fixed, precision: 15 })
        || text.byIdentification || text.type?.kind !== SemanticTypeKind.Character
        || text.type.length !== 255) {
        return false;
    }
    const result: SemanticType | undefined = signature.resultType;
    return result !== undefined && semanticTypeEquals(result, {
        kind: SemanticTypeKind.Bit, length: 1
    });
}

function shellName(value: string): string {
    return value.replace(/^['"]|['"]$/g, '').toUpperCase();
}

export function validateShellProcedures(
    module: ModuleNode,
    procedureSymbols: ReadonlyMap<ProcedureDeclarationNode, ProcedureSymbol>
): ShellProcedureValidation {
    const diagnostics: SemanticDiagnostic[] = [];
    const bindings = new Map<SourceValue<string>, ProcedureSymbol>();
    const commandsByProcedure = new Map<ProcedureDeclarationNode, ShellCommandNode>();

    if (!module.isShellModule()) {
        return { diagnostics, bindings, commandsByProcedure };
    }

    const definitions = new Map<string, {
        readonly node: ProcedureDeclarationNode;
        readonly symbol: ProcedureSymbol;
    }>();
    for (const child of module.problemPart?.getChildren() ?? []) {
        // Only definitions directly in this module's PROBLEM part qualify.
        if (child.kind !== AstKind.ProcedureDeclaration) {
            continue;
        }
        const node = child as ProcedureDeclarationNode;
        const symbol = procedureSymbols.get(node);
        if (symbol && !definitions.has(node.name.value)) {
            definitions.set(node.name.value, { node, symbol });
        }
    }

    const declaredProcedures = new Map<string, SourceValue<string>>();
    const commandNames = new Map<string, SourceValue<string>>();
    const emit = (code: SemanticDiagnosticCode, name: SourceValue<string>, message: string): void => {
        if (name.location) {
            diagnostics.push({ code, severity: SemanticDiagnosticSeverity.Error,
                location: name.location, message });
        }
    };

    for (const command of module.shellCommands) {
        const name = command.procedureName;
        const duplicate = declaredProcedures.get(name.value);
        if (duplicate) {
            emit(SemanticDiagnosticCode.DuplicateShellProcedure, name,
                `Shellprozedur '${name.value}' ist im SHELLMODULE-Kopf mehrfach angegeben.`);
            continue;
        }
        declaredProcedures.set(name.value, name);

        const cmdName = shellName(command.commandName.value);
        if (commandNames.has(cmdName)) {
            emit(SemanticDiagnosticCode.DuplicateShellCommand, command.commandName,
                `Shellbefehl '${cmdName}' ist im SHELLMODULE-Kopf mehrfach angegeben.`);
        } else {
            commandNames.set(cmdName, command.commandName);
        }

        const definition = definitions.get(name.value);
        if (!definition) {
            emit(SemanticDiagnosticCode.MissingShellProcedure, name,
                `Shellprozedur '${name.value}' muss im PROBLEM-Teil desselben SHELLMODULE als PROC definiert werden.`);
            continue;
        }

        bindings.set(name, definition.symbol);
        commandsByProcedure.set(definition.node, command);
        if (!checkShellSignature(definition.symbol.signature)) {
            emit(SemanticDiagnosticCode.InvalidShellProcedureSignature, definition.node.name,
                `Shellprozedur '${name.value}' benötigt die RTOS-UH-Shell-Signatur: `
                + `3 DATION ALPHIC IDENT, FIXED, CHAR(255), RETURNS(BIT(1)).`);
        }
    }

    // XHELP ({...}) marks an intended shell command. Without a MODULE-head
    // entry, the loader cannot expose it, even when the PROC itself exists.
    for (const [name, definition] of definitions) {
        if (definition.node.xhelpText && !declaredProcedures.has(name)) {
            emit(SemanticDiagnosticCode.UnregisteredShellProcedure, definition.node.name,
                `PROC '${name}' mit XHELP muss im SHELLMODULE-Kopf bekanntgegeben werden.`);
        }
    }

    return { diagnostics, bindings, commandsByProcedure };
}
