// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { formatSemanticType } from './semanticTypeDocumentation';
import { formatBuiltinPattern } from '../semantic/builtins/builtinSignature';
import type { BuiltinParameter } from '../semantic/builtins/builtinSignature';
import type { CallSignatureInformation } from '../semantic/callSignatureInformation';

/** Shared presentation for Signature Help and Hover; no symbol or scope lookup. */
export interface FormattedCallSignature {
    readonly label: string;
    readonly parameterRanges: readonly (readonly [number, number])[];
    readonly repeatedParameter: boolean;
}

export function formatCallSignature(info: CallSignatureInformation): FormattedCallSignature {
    let parameters: readonly string[];
    let result = '';
    let repeatedParameter = false;
    if (info.kind === 'procedure') {
        parameters = info.parameters.map(parameter =>
            `${parameter.name ? `${parameter.name.value} ` : ''}` +
            `${parameter.assignmentProtected ? 'INV ' : ''}` +
            `${parameter.type ? formatSemanticType(parameter.type) : '?'}` +
            `${parameter.byIdentification ? ' IDENT' : ''}`);
        if (info.procedureType.hasResult) {
            result = ` RETURNS(${info.procedureType.resultType
                ? formatSemanticType(info.procedureType.resultType) : '?'})`;
        }
    } else {
        parameters = info.signature.parameters.map(formatBuiltinParameter);
        if (info.signature.repeatedParameter) {
            parameters = [...parameters, `${formatBuiltinParameter(info.signature.repeatedParameter)}...`];
            repeatedParameter = true;
        }
        if (info.signature.result) {
            const value = info.signature.result;
            result = ` RETURNS(${value.kind === 'argument'
                ? `Typ von ${info.signature.parameters[value.index]?.name ?? 'Argument'}`
                : formatBuiltinPattern(value.type)})`;
        }
    }
    let label = `${info.name}(`;
    const parameterRanges: Array<readonly [number, number]> = [];
    parameters.forEach((parameter, index) => {
        if (index) label += ', ';
        const start = label.length;
        label += parameter;
        parameterRanges.push([start, label.length]);
    });
    label += `)${result}`;
    return { label, parameterRanges, repeatedParameter };
}

export function formatCallSignatures(signatures: readonly CallSignatureInformation[] | undefined): string | undefined {
    return signatures?.length
        ? signatures.map(signature => formatCallSignature(signature).label).join(' | ')
        : undefined;
}

function formatBuiltinParameter(parameter: BuiltinParameter): string {
    return `${parameter.name} ${formatBuiltinPattern(parameter.type)}`
        + (parameter.byIdentification ? ' IDENT' : '');
}
