// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SourceValue } from '../core/sourceValue';
import { AstNode } from './astNode';
import { AstKind } from './astKind';
import { AstLookupResult } from './astLookupResult';

import { DocumentationProvider } from '../documentation/documentationProvider';
import { ModuleDocumentationProvider } from '../documentation/moduleDocumentationProvider';

import { SystemPartNode } from './systemPartNode';
import { ProblemPartNode } from './problemPartNode';

export class ModuleNode extends AstNode {

    readonly keyword: SourceValue<string>;
    readonly name: SourceValue<string>;

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
}
