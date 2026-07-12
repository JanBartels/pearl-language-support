// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CompilerOption } from '../lexer';
import { md } from './markdownUtils';

export class CompilerOptionDocumentationProvider {

    static getDocumentation(
        option: CompilerOption
    ): string {

        switch (option.option.charAt(0)) {

            case 'L':
                if (option.mode) {
                    return md`
# Compiler Option +L

Übersetzungsprotokoll einschalten
`;
                } else {
                    return md`
# Compiler Option -L

Übersetzungsprotokoll ausschalten
`;
                }

            case 'P':
                if (option.mode) {
                    return md`
# Compiler Option +P

Codeprotokollierung einschalten
`;
                } else {
                    return md`
# Compiler Option -P

Codeprotokollierung ausschalten
`;
                }

            case 'M':
                if (option.mode) {
                    return md`
# Compiler Option +M

Markierungsoption einschalten. Evtl. in Verbindung mit MODE=NOLSTOP;
`;
                } else {
                    return md`
# Compiler Option -M

Markierungsoption ausschalten
`;
                }

            case 'N':
                if (option.mode) {
                    return md`
# Compiler Option +N

Seitenvorschub im Protokoll erzeugen
`;
                }
                // -N nicht erlaubt.
                break;

            case 'T':
                if (option.mode) {
                    return md`
# Compiler Option +T

Index–, Selektor– und Parametertest einschalten
`;
                } else {
                    return md`
# Compiler Option -T

Index–, Selektor– und Parametertest ausschalten
`;
                }

            case 'G':
                if (option.mode) {
                    return md`
# Compiler Option +G

EPROM–Prozedur erzeugen
`;
                }
                // -G nicht erlaubt.
                break;

            case 'S':
                if (option.mode) {
                    return md`
# Compiler Option +S

Prozedurparameterstrukturanalyse einschalten
`;
                } else {
                    return md`
# Compiler Option -S

Prozedurparameterstrukturanalyse ausschalten
`;
                }

            case 'R':
                return md`
# Compiler Option +R

Prozedurarbeitsspeicher reservieren
/*+R=hexazahl ... */
`;

            case 'F':
                if (option.mode) {
                    return md`
# Compiler Option +F

Konstantenpool leeren
`;
                }
                // -F nicht erlaubt.
                break;

            case 'D':
                if (option.mode) {
                    return md`
# Compiler Option +D

Default-PRIO setzen
`;
                }
                // -D nicht erlaubt.
                break;

        }

        return md`
# Unknown compiler option

\`${option.mode ? '+' : '-'}${option.option}\`
`;
    }
}
