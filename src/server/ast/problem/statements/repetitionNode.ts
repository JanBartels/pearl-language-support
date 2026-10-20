// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { Source } from "../../../source/source";
import { AstNode } from "../../astNode";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import { RepetitionDocumentationProvider } from
    "../../../documentation/problem/statements/repetitionDocumentationProvider";
import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createInclusiveFoldingRegion } from "../../../folding/foldingRegion";
import { RepetitionForClauseNode } from "./repetitionForClauseNode";
import { RepetitionExpressionClauseNode } from "./repetitionExpressionClauseNode";

export class RepetitionNode extends AstNode {

    private static readonly provider = new RepetitionDocumentationProvider();

    constructor(
        /** Original header tokens, without REPEAT, including tokens in erroneous clauses. */
        public readonly header: readonly SourceValue<string>[],
        public readonly forClause: RepetitionForClauseNode | undefined,
        public readonly fromClause: RepetitionExpressionClauseNode | undefined,
        public readonly byClause: RepetitionExpressionClauseNode | undefined,
        public readonly toClause: RepetitionExpressionClauseNode | undefined,
        public readonly whileClause: RepetitionExpressionClauseNode | undefined,
        public readonly repeatKeyword: SourceValue<string>,
        public readonly body: readonly AstNode[],
        public readonly endKeyword: SourceValue<string> | undefined,
        public readonly endIdentifier: SourceValue<string> | undefined
    ) {
        super(AstKind.Repetition);
        for (const clause of this.getClauses()) {
            this.adopt(clause);
        }
        this.adoptAll(body);
    }

    override documentationProvider(): DocumentationProvider<RepetitionNode> {
        return RepetitionNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        for (const child of this.getChildren()) {
            const result = child.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }

        return this.lookupOwnSourceValue(offset, this.repeatKeyword)
            ?? this.lookupOwnSourceValue(offset, this.endKeyword)
            ?? this.lookupOwnSourceValue(offset, this.endIdentifier);
    }

    override addFoldingRegionsTo(source: Source, regions: FoldingRegionCollection): void {
        const start = this.header[0] ?? this.repeatKeyword;

        if (!start.location || !this.endKeyword?.location) {
            return;
        }

        if (start.location.source !== source || this.endKeyword.location.source !== source) {
            return;
        }

        const region = createInclusiveFoldingRegion(start.location, this.endKeyword.location);
        if (region) {
            regions.add(region);
        }
    }

    override getChildren(): readonly AstNode[] {
        return [...this.getClauses(), ...this.body];
    }

    override dumpLabel(): string {
        const kinds = this.getClauses().map(clause => clause instanceof RepetitionForClauseNode
            ? "FOR"
            : clause.keyword.value);
        return kinds.length ? `Repetition(${kinds.join(", ")})` : "Repetition";
    }

    /** Compact, source-faithful display text; only whitespace between tokens is normalized. */
    headerText(): string {
        const tokens = [...this.header, this.repeatKeyword];
        let result = "";
        let previous: SourceValue<string> | undefined;

        for (const token of tokens) {
            const left = previous?.location;
            const right = token.location;
            const adjacent = left && right && left.source === right.source
                && left.span.end === right.span.start;
            result += previous && !adjacent ? " " : "";
            result += token.value;
            previous = token;
        }

        return result;
    }

    private getClauses(): (RepetitionForClauseNode | RepetitionExpressionClauseNode)[] {
        return [
            this.forClause,
            this.fromClause,
            this.byClause,
            this.toClause,
            this.whileClause
        ].filter((clause): clause is RepetitionForClauseNode | RepetitionExpressionClauseNode =>
            clause !== undefined);
    }
}
