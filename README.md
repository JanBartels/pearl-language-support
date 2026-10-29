# PEARL Language Support

PEARL Language Support ist eine Visual Studio Code Extension, die grundlegende Unterstützung für die Programmiersprache PEARL bietet.
Die Erweiterung liefert Syntax-Highlighting, Sprachdefinitionen sowie Integration eines Language Servers.

## Features

- Syntax-Highlighting für `.p` / `.P` Dateien
- Sprachkonfiguration (Keywords, Kommentare etc.)
- Integration eines Language Servers auf Basis von `vscode-languageserver`
- Automatische Aktivierung bei PEARL-Dateien

## Installation

### Aus VSIX (empfohlen für GPL-Projekte)

1. Lade die Datei `pearl-language-support-<version>.vsix` herunter
2. Installiere sie über die VS Code Kommandozeile:

code --install-extension pearl-language-support-<version>.vsix

### Aus dem Quellcode

git clone https://github.com/JanBartels/pearl-language-support.git
cd pearl-language-support
npm install

## Verwendung

Sobald du eine Datei mit der Endung `.p` oder `.P` öffnest, aktiviert sich die Extension automatisch.
Der Language Server wird automatisch gestartet und unterstützt grundlegende Sprachfunktionen.

### PEARL-Include-Dateien in VS Code

RTOS-UH verwendet für PEARL-Include-Dateien häufig die Dateiendungen `.h` und `.H`. VS Code erkennt diese standardmäßig als C/C++-Headerdateien.

Dadurch können C/C++-Language-Server wie clangd versuchen, PEARL-Quelltext zu analysieren. Dies führt zu zusätzlichen, unzutreffenden Fehlermeldungen und kann die Entwicklungsumgebung beeinträchtigen.

Für PEARL-Projekte empfiehlt sich deshalb folgende Einstellung in `.vscode/settings.json`:

```json
{
    "files.associations": {
        "*.h": "pearl",
        "*.H": "pearl"
    }
}
```

Die Datei `.vscode/settings.json` sollte in die Versionsverwaltung des Projekts aufgenommen werden, damit alle Entwickler dieselbe Sprachzuordnung verwenden.

Bei gemischten PEARL- und C/C++-Projekten muss die Zuordnung gegebenenfalls auf einzelne Dateien oder Verzeichnisse beschränkt werden.

## Entwicklung

### Build

Da das Projekt aktuell keinen Buildprozess hat:

npm run compile

### Tests

Momentan sind keine Tests vorhanden:

npm test

## Beiträge

Beiträge sind willkommen!

Indem du einen Beitrag (Pull Request) einreichst, erklärst du dich einverstanden,
dass dein Code unter der GPLv3 oder einer späteren Version veröffentlicht wird.
Weitere Details stehen in der Datei CONTRIBUTING.md.

## Lizenz

Dieses Projekt steht unter der GNU General Public License Version 3 (GPLv3) oder später.

Du darfst den Code ausführen, studieren, verändern und weitergeben,
solange sämtliche Weitergaben unter derselben Lizenz erfolgen.

Den vollständigen Lizenztext findest du in der Datei LICENSE
oder online unter:

https://www.gnu.org/licenses/gpl-3.0.html

## Hinweise

- Da die GPLv3 nicht mit den Nutzungsbedingungen des Microsoft Marketplace kompatibel ist,
  wird die Extension nicht über den offiziellen Marketplace veröffentlicht.
- Für GPL-kompatible Distribution wird die Extension über:
  - Open VSX Registry (geplant) oder
  - manuelle VSIX-Downloads
  bereitgestellt.

(C) 2025, 2026 Jan Bartels
