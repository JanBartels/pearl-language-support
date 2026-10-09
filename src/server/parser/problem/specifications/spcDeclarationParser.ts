// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SpcDeclarationNode } from '../../../ast/problem/specifications/spcDeclarationNode';
import { SpcDeclarationSentenceNode } from '../../../ast/problem/specifications/spcDeclarationSentenceNode';
import { ParserBase } from '../../parserBase';
import { SpcDeclarationSentenceParser } from './spcDeclarationSentenceParser';

export class SpcDeclarationParser extends ParserBase {
    override parse(): SpcDeclarationNode | undefined {
        this.skipTrivia();

        const keyword = this.acceptKeyword(['SPC', 'SPECIFY']);
        if (!keyword) {
            return undefined;
        }

        const specifications: SpcDeclarationSentenceNode[] = [];
        const first = new SpcDeclarationSentenceParser(this.context).parse();

        if (!first) {
            this.problems.error(this.location(), 'Expected specification after SPC.');
            this.synchronize([';']);
        } else {
            specifications.push(first);

            while (this.acceptComma()) {
                const specification = new SpcDeclarationSentenceParser(this.context).parse();
                if (specification) {
                    specifications.push(specification);
                    continue;
                }

                this.problems.error(this.location(), "Expected specification after ','.");
                this.synchronize([';']);
                break;
            }
        }

        if (!this.expectSemicolon()) {
            this.synchronize([';', 'TYPE', 'DCL', 'DECLARE', 'SPC', 'SPECIFY', 'MODEND']);
            this.acceptSemicolon();
        }

        return new SpcDeclarationNode(this.tokenValue(keyword), specifications);
    }
}
