// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { SemanticType, SemanticTypeKind } from '../semantic/semanticType';

export function formatSemanticType(type: SemanticType): string {
    switch (type.kind) {
        case SemanticTypeKind.Fixed:
            return type.precision === undefined ? 'FIXED' : `FIXED(${type.precision})`;

        case SemanticTypeKind.Float:
            return type.precision === undefined ? 'FLOAT' : `FLOAT(${type.precision})`;

        case SemanticTypeKind.Bit:
            return type.length === undefined ? 'BIT' : `BIT(${type.length})`;

        case SemanticTypeKind.Character:
            return type.length === undefined ? 'CHAR' : `CHAR(${type.length})`;

        case SemanticTypeKind.Clock:
            return 'CLOCK';

        case SemanticTypeKind.Duration:
            return 'DUR';

        case SemanticTypeKind.Sema:
            return 'SEMA';

        case SemanticTypeKind.Bolt:
            return 'BOLT';

        case SemanticTypeKind.Dation:
            return `DATION${type.direction ? ` ${type.direction}` : ''} ${type.dationClass}`;

        case SemanticTypeKind.Interrupt:
            return 'INTERRUPT';

        case SemanticTypeKind.Array:
            return `ARRAY(${type.dimensions.map(formatArrayDimension).join(', ')}) OF `
                + formatSemanticType(type.elementType);

        case SemanticTypeKind.VirtualArray:
            return `VIRTUAL ARRAY(rank ${type.rank}) OF ${formatSemanticType(type.elementType)}`;

        case SemanticTypeKind.Struct:
            return `STRUCT[${type.components
                .map(component => `${component.name.value} ${formatSemanticType(component.type)}`)
                .join(', ')}]`;

        case SemanticTypeKind.Task:
            return "TASK";

        case SemanticTypeKind.Procedure:
            const procedureKeyword = type.callingConvention === 'C' ? 'PROC_C' : 'PROC';
            return `${procedureKeyword}${type.parameters.length ? `(${type.parameters.map(p =>
                `${p.type ? formatSemanticType(p.type) : '?'}${p.byIdentification ? ' IDENT' : ''}`
            ).join(', ')})` : ''}${type.hasResult
                ? ` RETURNS(${type.resultType ? formatSemanticType(type.resultType) : '?'})` : ''}`;

        case SemanticTypeKind.Reference:
            return `REF ${type.targetInvariant ? 'INV ' : ''}${formatSemanticType(type.target)}`;

        case SemanticTypeKind.Named:
            return type.symbol.name.value;

        case SemanticTypeKind.VoidReference:
            return `REF ${type.targetInvariant ? 'INV ' : ''}STRUCT[]`;
    }
}

function formatArrayDimension(dimension: { readonly lowerBound: bigint; readonly upperBound: bigint }): string {
    return dimension.lowerBound === BigInt(1)
        ? dimension.upperBound.toString()
        : `${dimension.lowerBound}:${dimension.upperBound}`;
}
