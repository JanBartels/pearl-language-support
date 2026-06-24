// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/*
namespace – Namespaces, Module, Packages
type – generische oder sonstige Typen, die nicht besser zuordenbar sind (Fallback)
class – Klassen
enum – Enums
interface – Interfaces
struct – Structs
typeParameter – Typparameter (z. B. T in List<T>)
parameter – Funktions-/Methodenparameter
variable – lokale Variablen, ggf. auch globale, je nach Sprache
property – Eigenschaften / Felder eines Typs
enumMember – einzelne Enum-Werte
event – Events
function – Funktionen (nicht-methodisch, z. B. freie Funktionen)
method – Methoden an Klassen/Interfaces/Structs
macro – Makros (z. B. C- oder Rust-Makros)
keyword – Sprach-Schlüsselwörter
modifier – Sprach-Modifier wie public, private, static etc. (als Token-Typ, nicht zu verwechseln mit Token-Modifiers)
comment – Kommentare
string – String-Literale
number – numerische Literale
regexp – Regex-Literale
operator – Operatoren (z. B. +, ==)
decorator – Dekoratoren / Attribute (z. B. Component)
label – Sprunglabels
*/

export const semanticTokenTypes = [
  'type',       // generische oder sonstige Typen, die nicht besser zuordenbar sind (Fallback)
  'variable',   // DCL-Variablen, SPC-Variablen
  'parameter',  // PROC-Parameter
  'function',   // PROC / ENTRY
  'class',      // TASK (oder "class"-ähnlich)
  'property',   // SEMA, BOLT
  'label',      // Sprungmarken MyLabel:
  'operator',   // Operatoren (z. B. +, ==)  
  'string',     // String-Literale
  'number'      // numerische Literale
] as const;

/*
declaration – die Stelle, an der etwas deklariert wird
definition – die Stelle, an der etwas definiert/implementiert wird (falls getrennt von der Deklaration)
readonly – schreibgeschütztes Symbol (z. B. const)
static – statisches Element
deprecated – veraltetes Symbol
abstract – abstraktes Symbol
async – asynchrones Symbol (z. B. async function)
modification – Stelle, an der ein Wert verändert wird (Assignment, ++ usw.)
documentation – Dokumentationskommentar o. Ä.
defaultLibrary – Symbol stammt aus der Standardbibliothek / Runtime
*/

export const semanticTokenModifiers = [
  'declaration', // an der Deklarationsstelle
  'readonly'
] as const;
