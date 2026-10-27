// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../../../core/sourceValue';
import { SourceOffset } from '../../../core/sourceOffset';
import { AstKind } from '../../astKind';
import { AstLookupResult } from '../../astLookupResult';
import { AstNode } from '../../astNode';
import { ActualParameterNode } from './actualParameterNode';

/** Parenthesized actual parameters of a CALL statement.
 *
 * Commas separate the parameter slots at the outermost level. Commas in nested
 * expressions remain part of their parameter's token sequence. A missing
 * closing parenthesis is represented by `closeParenthesis === undefined`.
 */
export class ActualParameterListNode extends AstNode {
    constructor(
        public readonly openParenthesis: SourceValue<string>,
        public readonly parameters: readonly ActualParameterNode[],
        public readonly commas: readonly SourceValue<string>[],
        public readonly closeParenthesis: SourceValue<string> | undefined,
        /** First token outside an unclosed list (including the zero-length EOF).
         * Recovery metadata, not a syntactic child of the argument list.
         */
        public readonly recoveryBoundary?: SourceValue<string>
    ) {
        super(AstKind.ActualParameterList);
        this.adoptAll(parameters);
    }

    override documentationProvider(): undefined { return undefined; }

    override lookupSourceValue(position: SourceOffset): AstLookupResult | undefined {
        const opening = this.lookupOwnSourceValue(position, this.openParenthesis);
        if (opening) return opening;

        for (const parameter of this.parameters) {
            const found = parameter.lookupSourceValue(position);
            if (found) return found;
        }

        for (const comma of this.commas) {
            const found = this.lookupOwnSourceValue(position, comma);
            if (found) return found;
        }

        return this.lookupOwnSourceValue(position, this.closeParenthesis);
    }

    override getChildren(): readonly AstNode[] { return this.parameters; }

    /** Compatibility view for the existing call semantics and documentation.
     *
     * The final, still-empty slot after a comma is represented in `parameters`
     * but is not counted as a supplied argument until tokens have been typed.
     * Empty slots before commas are retained, as in the original parser.
     */
    get argumentsList(): readonly (readonly SourceValue<string>[])[] {
        return this.parameters
            .filter((parameter, index) => index < this.commas.length || parameter.tokens.length > 0)
            .map(parameter => parameter.tokens);
    }

    override dumpLabel(): string {
        return `ActualParameterList(${this.parameters.length} slots${
            this.closeParenthesis ? '' : ', unclosed'})`;
    }
}
