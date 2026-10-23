// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SourceValue } from '../core/sourceValue';
import type { BuiltinDefinition } from './builtins/builtinSignature';
import type { SemanticDiagnostic } from './semanticDiagnostic';
import type { SemanticSymbol } from './symbol';
import type { SymbolReference } from './symbolReference';

/**
 * A reference and its semantic result are separate compiler information.
 * Every syntactically collected reference receives exactly one result.
 *
 * 'unresolved' does not automatically mean "unknown identifier": it can also
 * mean that the current semantic analyzer did not establish a binding.
 * Existing diagnostics remain the authority on language errors.
 */
export type SymbolReferenceResolution =
    | {
        readonly kind: 'bound';
        readonly reference: SymbolReference;
        readonly symbol: SemanticSymbol;
        /** Physical declaration if known, otherwise the name introducing this symbol. */
        readonly declaration: SourceValue<string>;
        readonly diagnostics: readonly SemanticDiagnostic[];
    }
    | {
        readonly kind: 'builtin';
        readonly reference: SymbolReference;
        readonly builtin: BuiltinDefinition;
        readonly diagnostics: readonly SemanticDiagnostic[];
    }
    | {
        readonly kind: 'unresolved';
        readonly reference: SymbolReference;
        readonly diagnostics: readonly SemanticDiagnostic[];
    }
    | {
        readonly kind: 'deferred';
        readonly reference: SymbolReference;
        readonly reason: 'structuralName';
        readonly diagnostics: readonly SemanticDiagnostic[];
    };
