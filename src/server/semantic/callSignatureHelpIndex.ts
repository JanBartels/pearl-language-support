// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../ast/astKind';
import type { AstNode } from '../ast/astNode';
import { CallStatementNode } from '../ast/problem/statements/callStatementNode';
import { NameSegmentNode } from '../ast/problem/expressions/nameSegmentNode';
import { NameArgumentListNode } from '../ast/problem/expressions/nameArgumentListNode';
import { ActualParameterListNode } from '../ast/problem/statements/actualParameterListNode';
import type { SourceOffset } from '../core/sourceOffset';
import { mapToOriginalLocation } from '../core/sourceOffset';
import type { SourceValue } from '../core/sourceValue';
import { CallSignatureIndex } from './callSignatureIndex';
import type { CallSignatureInformation } from './callSignatureInformation';

/** The compiler-side call context at a physical editor cursor. */
export interface CallSignatureHelpContext {
    readonly call: CallStatementNode | NameSegmentNode;
    readonly signatures: readonly CallSignatureInformation[];
    /** Zero-based syntactic position, independent of the formal arity. */
    readonly activeParameter: number;
}

interface CallSite {
    readonly call: CallStatementNode | NameSegmentNode;
    readonly signatures: readonly CallSignatureInformation[];
    readonly uri: string;
    readonly start: number;
    readonly end: number;
    readonly endInclusive: boolean;
    readonly commas: readonly number[];
}

/**
 * Compiler-side position index for CALL statements and expression calls.
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
            } else if (node.kind === AstKind.NameSegment) {
                const segment = node as NameSegmentNode;
                if (segment.suffix) {
                    const known = signatures.getForElement(segment.identifier);
                    if (known?.length) {
                        const site = makeExpressionSite(segment, known);
                        if (site) sites.push(site);
                    }
                }
            }
            for (const child of node.getChildren()) visit(child);
        };
        visit(root);
        this.sites = sites;
    }

    lookup(position: SourceOffset): CallSignatureHelpContext | undefined {
        let result: CallSignatureHelpContext | undefined;
        let selected: CallSite | undefined;
        for (const site of this.sites) {
            if (position.uri !== site.uri || position.offset < site.start ||
                (site.endInclusive ? position.offset > site.end : position.offset >= site.end)) {
                continue;
            }
            // Nested calls use the innermost argument list. Identical or
            // intersecting non-nested source intervals remain ambiguous.
            if (selected) {
                if (site.start === selected.start && site.end === selected.end) return undefined;
                if (site.start >= selected.start && site.end <= selected.end) {
                    // The new site is nested in the previous one.
                } else if (selected.start >= site.start && selected.end <= site.end) {
                    continue;
                } else {
                    return undefined;
                }
            }
            let activeParameter = 0;
            for (const commaEnd of site.commas) {
                if (commaEnd > position.offset) break;
                activeParameter++;
            }
            selected = site;
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
    return siteFromDelimiters(call, signatures, list, true);
}

/** Expression suffixes are syntactically neutral; only a bound callable
 * identifier from CallSignatureIndex makes one a signature-help site.
 */
function makeExpressionSite(
    segment: NameSegmentNode,
    signatures: readonly CallSignatureInformation[]
): CallSite | undefined {
    const list = segment.suffix;
    if (!list) return undefined;
    return siteFromDelimiters(segment, signatures, list, false);
}

function siteFromDelimiters(
    call: CallStatementNode | NameSegmentNode,
    signatures: readonly CallSignatureInformation[],
    list: ActualParameterListNode | NameArgumentListNode,
    validateCallTokens: boolean
): CallSite | undefined {
    const opening = physical(list.openParenthesis);
    const recovery = list instanceof ActualParameterListNode ? list.recoveryBoundary : undefined;
    const closing = physical(list.closeParenthesis ?? recovery);
    // NameArgumentList has no recovery boundary: an unfinished expression
    // must not create an unbounded editor interval.
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
    if (validateCallTokens && list instanceof ActualParameterListNode) {
        for (const argument of list.parameters) {
            for (const token of argument.tokens) {
                const location = physical(token);
                if (!location || location.uri !== opening.uri ||
                    location.start < opening.end || location.end > closing.start) return undefined;
            }
        }
    }
    return {
        call, signatures, uri: opening.uri, start: opening.end,
        end: closing.start, endInclusive: !!list.closeParenthesis ||
            recovery?.value === '', commas: commaEnds
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
