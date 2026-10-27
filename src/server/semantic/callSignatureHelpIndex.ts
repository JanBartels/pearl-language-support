// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import type { SourceOffset } from '../core/sourceOffset';
import { mapToOriginalLocation } from '../core/sourceOffset';
import type { SourceValue } from '../core/sourceValue';
import { CallSignatureIndex } from './callSignatureIndex';
import type { CallSignatureInformation } from './callSignatureInformation';

/** The compiler-side call context at a physical editor cursor. */
export interface CallSignatureHelpContext {
    readonly call: CallStatementNode;
    readonly signatures: readonly CallSignatureInformation[];
    /** Zero-based syntactic position, independent of the formal arity. */
    readonly activeParameter: number;
}

interface CallSite {
    readonly call: CallStatementNode;
    readonly signatures: readonly CallSignatureInformation[];
    readonly uri: string;
    readonly start: number;
    readonly end: number;
    readonly endInclusive: boolean;
    readonly commas: readonly number[];
}

/**
 * Compiler-side position index for CALL statements (explicit and implicit).
 * The index uses only stored SourceValues and the already computed bindings;
 * it never reparses expressions or resolves names by itself.
 *
 * A call is indexed only when its delimiters map to one unambiguous physical
 * source interval. Macro expansions that collapse/mix delimiters are skipped,
 * rather than guessing an active parameter in the editor.
 */
export class CallSignatureHelpIndex {
    private readonly sites: readonly CallSite[];

    constructor(root: AstNode, signatures: CallSignatureIndex) {
        const sites: CallSite[] = [];
        const visit = (node: AstNode): void => {
            if (node.kind === AstKind.CallStatement) {
                const call = node as CallStatementNode;
                const known = signatures.get(call);
                if (known?.length) {
                    const site = makeSite(call, known);
                    if (site) sites.push(site);
                }
            }
            for (const child of node.getChildren()) visit(child);
        };
        visit(root);
        this.sites = sites;
    }

    lookup(position: SourceOffset): CallSignatureHelpContext | undefined {
        let result: CallSignatureHelpContext | undefined;
        for (const site of this.sites) {
            if (position.uri !== site.uri || position.offset < site.start ||
                (site.endInclusive ? position.offset > site.end : position.offset >= site.end)) {
                continue;
            }
            // A position matching multiple expansions is ambiguous. Do not
            // arbitrarily choose the first call site.
            if (result) return undefined;
            let activeParameter = 0;
            for (const commaEnd of site.commas) {
                if (commaEnd > position.offset) break;
                activeParameter++;
            }
            result = { call: site.call, signatures: site.signatures, activeParameter };
        }
        return result;
    }
}

function makeSite(
    call: CallStatementNode,
    signatures: readonly CallSignatureInformation[]
): CallSite | undefined {
    const list = call.actualParameters;
    if (!list) return undefined;
    const opening = physical(list.openParenthesis);
    const closing = physical(list.closeParenthesis ?? list.recoveryBoundary);
    if (!opening || !closing || opening.uri !== closing.uri ||
        opening.end > closing.start) return undefined;

    const commaEnds: number[] = [];
    let previousEnd = opening.end;
    for (const comma of list.commas) {
        const location = physical(comma);
        if (!location || location.uri !== opening.uri ||
            location.start < previousEnd || location.end > closing.start ||
            location.start === location.end) return undefined;
        commaEnds.push(location.end);
        previousEnd = location.end;
    }

    // An argument may come from an include file. In that case an interval in
    // the containing file is not sufficient to describe the editor position.
    for (const argument of list.parameters) {
        for (const token of argument.tokens) {
            const location = physical(token);
            if (!location || location.uri !== opening.uri ||
                location.start < opening.end || location.end > closing.start) return undefined;
        }
    }

    return {
        call, signatures, uri: opening.uri, start: opening.end,
        end: closing.start, endInclusive: !!list.closeParenthesis ||
            list.recoveryBoundary?.value === '', commas: commaEnds
    };
}

function physical(value: SourceValue<string> | undefined):
    { uri: string; start: number; end: number } | undefined {
    if (!value?.location) return undefined;
    const location = mapToOriginalLocation(value.location);
    return {
        uri: location.source.uri,
        start: location.span.start,
        end: location.span.end
    };
}
