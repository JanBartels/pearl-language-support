// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import type { SignatureHelp, SignatureInformation } from 'vscode-languageserver';
import { formatCallSignature } from '../documentation/callSignatureFormatting';
import type { CallSignatureHelpContext } from '../semantic/callSignatureHelpIndex';
import type { CallSignatureInformation } from '../semantic/callSignatureInformation';

/** Only presentation/mapping to LSP types; no parser or scope logic. */
export function createSignatureHelp(context: CallSignatureHelpContext): SignatureHelp {
    const signatures = context.signatures.map(info => signatureInformation(info, context.activeParameter));
    return { signatures, activeSignature: 0, activeParameter: signatures[0]?.activeParameter };
}

function signatureInformation(info: CallSignatureInformation, position: number): SignatureInformation {
    const formatted = formatCallSignature(info);
    const activeParameter = position < formatted.parameterRanges.length
        ? position
        : formatted.repeatedParameter && formatted.parameterRanges.length
            ? formatted.parameterRanges.length - 1 : undefined;
    return {
        label: formatted.label,
        parameters: formatted.parameterRanges.map(label => ({ label: [label[0], label[1]] })),
        activeParameter
    };
}
