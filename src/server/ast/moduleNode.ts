// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { Source } from "../source/source";
import { SourceValue } from '../core/sourceValue';
import { AstNode } from './astNode';
import { AstKind } from './astKind';
import { AstLookupResult } from './astLookupResult';

import { DocumentationProvider } from '../documentation/documentationProvider';
import { ModuleDocumentationProvider } from '../documentation/moduleDocumentationProvider';

import { FoldingRegionCollection } from '../folding/foldingRegionCollection';
import { createInclusiveFoldingRegion, createExclusiveFoldingRegion } from '../folding/foldingRegion';

import { ShellCommandNode } from './shellCommandNode';
import { SystemPartNode } from './systemPartNode';
import { ProblemPartNode } from './problemPartNode';

export class ModuleNode extends AstNode {

    readonly keyword: SourceValue<string>;
    readonly name: SourceValue<string>;

    readonly shellCommands: ShellCommandNode[] = [];

    systemPart?: SystemPartNode;

    problemPart?: ProblemPartNode;

    modendKeyword?: SourceValue<string>;
    debugKeyword?: SourceValue<string>;

    private static readonly provider = new ModuleDocumentationProvider();
    
    constructor(
        keyword: SourceValue<string>,
        name: SourceValue<string>
    ) {
        super(AstKind.Module);

        this.keyword = keyword;
        this.name = name;
    }

    override documentationProvider():
        DocumentationProvider<ModuleNode> {

        return ModuleNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        let result: AstLookupResult | undefined;

        for (const shellCommand of this.shellCommands) {
            result = shellCommand.lookupSourceValue(offset);
            if (result) {
                return result;
            }
        }

        result = this.systemPart?.lookupSourceValue(offset);
        if (result) {
            return result;
        }

        result = this.problemPart?.lookupSourceValue(offset);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.keyword);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.name);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.modendKeyword);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.debugKeyword);
        if (result) {
            return result;
        }

        return undefined;
    }

    override addFoldingRegionsTo(
        source: Source,
        regions: FoldingRegionCollection
    ): void {

        if (this.keyword.location && this.modendKeyword?.location && this.keyword.location.source === source) {
            const region = createInclusiveFoldingRegion(this.keyword.location, this.modendKeyword.location);
            if ( region ) {
              regions.add(region);
            }
        }

        if (this.systemPart?.keyword.location) {

            const end =
                this.problemPart?.keyword.location
                ?? this.modendKeyword?.location;

            if (this.systemPart.keyword.location && end) {
                const region = createExclusiveFoldingRegion(this.systemPart.keyword.location, end);
                if ( region ) {
                    regions.add(region);
                }
            }
        }

        if (this.problemPart?.keyword.location) {

            const end = this.modendKeyword?.location;

            if (this.problemPart.keyword.location && end) {
                const region = createExclusiveFoldingRegion(this.problemPart.keyword.location, end);
                if ( region ) {
                    regions.add(region);
                }
            }
        }

    }

    public override dumpLabel(): string {
       return `Module(${this.name.value})`;
    }

    public override getChildren(): readonly AstNode[] {
        const result: AstNode[] = [];

        if (this.systemPart) {
            result.push(this.systemPart);
        }

        if (this.problemPart) {
            result.push(this.problemPart);
        }

        return result;
    }

    public isShellModule(): boolean {
        return (this.keyword.value === "SHELLMODULE");
    }
}
