// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from "../../../core/sourceValue";
import { Source } from "../../../source/source";
import { AstNode } from "../../astNode";
import { AstKind } from "../../astKind";
import { AstLookupResult } from "../../astLookupResult";
import { DocumentationProvider } from "../../../documentation/documentationProvider";
import {
    RepetitionDocumentationProvider
} from "../../../documentation/problem/statements/repetitionDocumentationProvider";
import { FoldingRegionCollection } from "../../../folding/foldingRegionCollection";
import { createInclusiveFoldingRegion } from "../../../folding/foldingRegion";

export class RepetitionNode extends AstNode {

    private static readonly provider = new RepetitionDocumentationProvider();

    constructor(
        public readonly header: readonly SourceValue<string>[],
        public readonly repeatKeyword: SourceValue<string>,
        public readonly body: readonly AstNode[],
        public readonly endKeyword: SourceValue<string> | undefined,
        public readonly endIdentifier: SourceValue<string> | undefined
    ) {
        super(AstKind.Repetition);
        this.adoptAll(body);
    }

    override documentationProvider(): DocumentationProvider<RepetitionNode> {
        return RepetitionNode.provider;
    }

    override lookupSourceValue(offset: number): AstLookupResult | undefined {
        for (const child of this.body) {
            const result = child.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }

        for (const token of this.header) {
            const result = this.lookupOwnSourceValue(offset, token);
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
        return this.body;
    }
}
