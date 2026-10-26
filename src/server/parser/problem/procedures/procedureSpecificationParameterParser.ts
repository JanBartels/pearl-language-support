// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { ProcedureSpecificationParameterNode }
    from '../../../ast/problem/procedures/procedureSpecificationParameterNode';
import { NamedTypeNode } from '../../../ast/problem/types/namedTypeNode';
import { ParserBase } from '../../parserBase';
import { ProcedureParameterTypeParser } from '../declarations/procedureParameterTypeParser';
import { VirtualDimensionListParser } from '../dimensions/virtualDimensionListParser';
import { ProblemDataTypeParser } from '../types/problemDataTypeParser';

/** FormalParameterFor-SPC ::= [documentary-name [virtual-dimensions]] Type [IDENT]. */
export class ProcedureSpecificationParameterParser extends ParserBase {
    override parse(): ProcedureSpecificationParameterNode | undefined {
        this.skipTrivia();
        let name;
        let dimensions;
        let type;

        // A user-defined type is also an identifier. Read it as a type unless
        // another type follows; only that situation makes it a documentary name.
        const first = this.acceptIdentifier();
        if (first) {
            const value = this.tokenValue(first);
            this.skipTrivia();
            if (this.isIdentifier() || this.isKeyword([
                'FIXED', 'FLOAT', 'BIT', 'CHAR', 'CHARACTER', 'CLOCK', 'DUR', 'DURATION',
                'REF', 'STRUCT', 'DATION', 'SEMA', 'BOLT', 'IRPT', 'INTERRUPT', 'SIGNAL'
            ]) || this.isOperator('(')) {
                name = value;
                dimensions = new VirtualDimensionListParser(this.context).parse();
            } else {
                type = new NamedTypeNode(value);
            }
        }

        // The documentary parameter name is optional. An unnamed array
        // parameter therefore starts directly with its virtual dimensions:
        // ENTRY( () FIXED ) or ENTRY( (,) FIXED ).
        // When a name was present, its dimensions have already been parsed.
        dimensions ??= new VirtualDimensionListParser(this.context).parse();

        type ??= new ProcedureParameterTypeParser(this.context).parse()
            ?? new ProblemDataTypeParser(this.context).parse();
        if (!type) {
            this.problems.error(this.location(), 'Expected parameter type in procedure signature.');
            return undefined;
        }
        this.skipTrivia();
        const ident = this.acceptKeyword(['IDENT', 'IDENTICAL']);
        return new ProcedureSpecificationParameterNode(
            name, dimensions, type, ident ? this.tokenValue(ident) : undefined
        );
    }
}
