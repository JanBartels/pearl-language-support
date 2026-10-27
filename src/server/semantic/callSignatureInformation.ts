// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { BuiltinDefinition, BuiltinSignature } from './builtins/builtinSignature';
import type { ProcedureParameterType, ProcedureType } from './semanticType';

/** A formal parameter's semantic type plus an optional display name.
 * Display names may come from PEARL syntax or documentary comments and
 * intentionally never participate in ProcedureType or type equality.
 */
export interface ProcedureCallParameterInformation extends ProcedureParameterType {
    readonly name: SourceValue<string> | undefined;
    /** This is display metadata, never a semantic declaration or type component. */
    readonly nameOrigin?: 'explicit' | 'comment';
}

/** Compiler information for one possible call signature. No LSP types or presentation text. */
export type CallSignatureInformation =
    | {
        readonly kind: 'procedure';
        readonly name: string;
        readonly procedureType: ProcedureType;
        readonly parameters: readonly ProcedureCallParameterInformation[];
    }
    | {
        readonly kind: 'builtin';
        readonly name: string;
        readonly builtin: BuiltinDefinition;
        readonly signature: BuiltinSignature;
    };
