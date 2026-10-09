// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { AstKind } from '../../../ast/astKind';
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

        const virtualDimensionLocation = this.location();
        let virtualDimensions = new VirtualDimensionListParser(this.context).parse();
        const attribute = new SpcAttributeParser(this.context).parse();

        if (!attribute) {
            this.problems.error(this.location(), 'Expected specification attribute.');
            this.synchronize([',', ';']);
        } else if (virtualDimensions && (attribute.kind === AstKind.SpcDationAttribute
            || attribute.kind === AstKind.SpcInterruptAttribute)) {
            this.problems.error(virtualDimensionLocation, 'Virtual dimensions are not allowed for this SPC attribute.');
            virtualDimensions = undefined;
        }

        return new SpcDeclarationSentenceNode(identifiers, virtualDimensions, attribute);
    }
}
