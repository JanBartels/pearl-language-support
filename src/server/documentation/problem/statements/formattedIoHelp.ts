// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

const help: Readonly<Record<string,string>> = {
    GET: 'Liest Daten aus einer ALPHIC-DATION gemäß der Formatliste. Datenliste und Formatliste werden in einer eigenen semantischen Analyse abgeglichen.',
    PUT: 'Schreibt Daten auf eine ALPHIC-DATION gemäß der Formatliste.',
    CONVERT: 'Konvertiert Daten zwischen PEARL-Objekten und einer Zeichenkette; TO schreibt die Zeichenkette, FROM liest daraus.',
    FROM: 'Quelle der formatierten Eingabe: DATION bei GET oder Zeichenkettenausdruck bei CONVERT.',
    TO: 'Ziel der formatierten Ausgabe: DATION bei PUT oder beschreibbare Zeichenkettenvariable bei CONVERT.',
    BY: 'Leitet die Formatliste ein. Die Formate steuern die Reihenfolge der Datentransfers.',
    FORMAT: 'Deklariert eine wiederverwendbare Formatliste, die mit R(Name) referenziert werden kann.',
    F: 'FIXED- oder FLOAT-Konvertierung: F(Breite[,Nachkommastellen[,Skalierung]]).',
    E: 'FIXED- oder FLOAT-Konvertierung mit Exponent: E(Breite[,Nachkommastellen[,Signifikanz]]).',
    A: 'Zeichenkettenformat A[(Länge)]. Ohne Länge wird die Zeichenkettenlänge verwendet.',
    B: 'Binäres BIT-Format B[(Länge)].',
    B3: 'Oktales BIT-Format B3[(Länge)].',
    B4: 'Hexadezimales BIT-Format B4[(Länge)].',
    T: 'CLOCK-Format T(Breite[,Nachkommastellen]).',
    D: 'DURATION-Format D(Breite[,Nachkommastellen]).',
    LIST: 'Typabhängiges Standardformat; verarbeitet ein Datenobjekt.',
    R: 'Fügt die mit R(Formatname) bezeichnete FORMAT-Deklaration ein.',
    RST: 'RST(Fehlervariable) setzt das Ziel für nachfolgende Konvertierungsfehler. Erwartet eine beschreibbare FIXED-Variable.',
    X: 'X[(Anzahl)]: überspringt Zeichen bei Eingabe oder gibt Leerzeichen aus; verbraucht kein Datenobjekt.',
    SKIP: 'SKIP[(Anzahl)]: Zeilenwechsel bzw. Überspringen einer Eingabezeile; verbraucht kein Datenobjekt.',
    PAGE: 'PAGE[(Anzahl)]: Seitenwechsel; verbraucht kein Datenobjekt.',
    S: 'S(FIXED-Variable): Format zur Positions-/Längeninformation in CONVERT (abhängig vom RTOS-UH-Sprachumfang).'
};

/** Shared text only; AST-specific lookup remains in each node's provider. */
export function formattedIoHelp(keyword: string): string | undefined {
    const description = help[keyword];
    return description ? `# ${keyword}\n\n${description}` : undefined;
}
