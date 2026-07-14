// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../astKind';
import { SourceValue } from '../../../core/sourceValue';
import { AstLookupResult } from '../../astLookupResult';

import { SystemDeclarationNode } from './systemDeclarationNode';
import { DocumentationProvider } from '../../../documentation/documentationProvider';
import { AlphicDationDocumentationProvider } from '../../../documentation/system/declarations/alphicDationDocumentationProvider';

export class AlphicDationSystemDeclarationNode extends SystemDeclarationNode {

    private static readonly provider = new AlphicDationDocumentationProvider();
    
    constructor(
        name: SourceValue<string>,
        public readonly systemName: SourceValue<string>,
        public readonly direction: SourceValue<string>,
        public readonly tfu: SourceValue<string> | undefined,
        public readonly neFlag: SourceValue<boolean>,
        public readonly mb: SourceValue<string> | undefined,
        public readonly ai: SourceValue<string> | undefined
    ) {
        super(
            AstKind.AlphicDationSystemDeclaration,
            name
        );
    }

    override documentationProvider():
            DocumentationProvider<AlphicDationSystemDeclarationNode> {

            return AlphicDationSystemDeclarationNode.provider;
    }

    override lookupSourceValue(
        offset: number
    ): AstLookupResult | undefined {

        let result = this.lookupOwnSourceValue(offset, this.name);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.systemName);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.direction);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.tfu);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.neFlag);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.mb);
        if (result) {
            return result;
        }

        result = this.lookupOwnSourceValue(offset, this.ai);
        if (result) {
            return result;
        }

        return undefined;
    }

    public override dumpLabel(): string {
        return `ALPHIC Dation(${this.name.value} systemName ${this.systemName.value} direction ${this.direction.value})`;
    }
}

