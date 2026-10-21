// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { CompilerOption } from '../lexer';
import { md } from '../documentation/markdownUtils';

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

Markierungsoption einschalten. Ohne \`MODE=NOLSTOP;\` kann die Markierung die Laufzeit erheblich verlangsamen.

Mit NOLSTOP ist der Aufwand deutlich geringer, der Zeilenstop beim Tracen ist dann jedoch nicht möglich.
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

RTOS-UH: Erzeugt für eine Prozedur einen vom Lader auffindbaren Eintrag
(17er-Scheibe) für EPROM- bzw. Boot-Bibliotheken.

Die Option muss unmittelbar **hinter PROC oder PROCEDURE** stehen,
beispielsweise \`P: PROC /*+G*/ (...) GLOBAL;\`.

Die Option macht die Prozedur **nicht** im PEARL-Sinne global.
Für eine \`/*+G*/\`-Prozedur ist deshalb zusätzlich \`GLOBAL\` erforderlich
(RTOS-UH, Abschnitt 5.4.6). Ohne \`GLOBAL\` wird ein Fehler gemeldet.

**Laderbedingung:** Die erzeugte 17er-Scheibe muss in einem Modulkopf
auffindbar sein. Da die Speicherverkettung aus Modulen (MDLE) und TASKs
besteht, müssen \`/*+G*/\`-Prozeduren im PROBLEM-Teil **vor der ersten
TASK des Moduls** stehen. Diese Bedingung folgt aus dem Speicher- und
Laderaufbau; sie wird im Handbuch nicht ausdrücklich als Positionsregel
formuliert.
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
