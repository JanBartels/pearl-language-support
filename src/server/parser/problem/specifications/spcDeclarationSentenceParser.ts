// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcDeclarationSentenceNode } from '../../../ast/problem/specifications/spcDeclarationSentenceNode';
import { ParserBase } from '../../parserBase';
import { VirtualDimensionListParser } from '../dimensions/virtualDimensionListParser';
import { OneIdentifierOrListParser } from '../identifiers/oneIdentifierOrListParser';
import { SpcAttributeParser } from './spcAttributeParser';

export class SpcDeclarationSentenceParser extends ParserBase {
    override parse(): SpcDeclarationSentenceNode | undefined {
        this.skipTrivia();

        const identifiers = new OneIdentifierOrListParser(this.context).parse();
        if (!identifiers) {
            return undefined;
        }

        const virtualDimensions = new VirtualDimensionListParser(this.context).parse();
        const attribute = new SpcAttributeParser(this.context).parse();

        if (!attribute) {
            this.problems.error(this.location(), 'Expected specification attribute.');
            this.synchronize([',', ';']);
        }

        return new SpcDeclarationSentenceNode(identifiers, virtualDimensions, attribute);
    }
}
