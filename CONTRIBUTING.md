# Beiträge zu PEARL Language Support

Vielen Dank für dein Interesse an **PEARL Language Support**!  
Beiträge in Form von Bugmeldungen, Ideen, Dokumentation und Code sind sehr willkommen.

Bitte lies diese Hinweise, bevor du einen Pull Request öffnest.

---

## 💡 Wie du beitragen kannst

- 🐞 **Bugs melden**  
  - Erstelle ein Issue auf GitHub  
  - Beschreibe:
    - verwendetes Betriebssystem
    - Node.js-Version
    - VS Code-Version
    - Schritte zur Reproduktion
    - ggf. Beispiel-PEARL-Code

- 💭 **Feature-Vorschläge**  
  - Erstelle ein Issue mit dem Label `enhancement`  
  - Beschreibe kurz:
    - welches Problem du lösen möchtest
    - wie du dir die Lösung vorstellst
    - ob es breaking changes geben könnte

- 📚 **Dokumentation verbessern**  
  - Rechtschreibkorrekturen
  - README-Verbesserungen
  - Beispiele für PEARL-Code

- 💻 **Code-Beiträge (Pull Requests)**  
  - Siehe Abschnitt „Code-Richtlinien“ unten.

---

## 🔧 Entwicklungs-Setup

Voraussetzungen:

- Node.js (empfohlen: aktuelle LTS oder neuer)
- npm
- VS Code

Projekt klonen:

git clone https://github.com/JanBartels/pearl-language-support.git
cd pearl-language-support
npm install

Extension in VS Code starten:

1. Repository im VS Code öffnen
2. F5 drücken, um eine „Extension Development Host“-Instanz zu starten
3. Eine `.p` oder `.P` Datei öffnen, um die Extension zu testen

---

## 🧩 Code-Richtlinien

- Versuche, bestehenden Stil beizubehalten (Einrückung, Benennung, Struktur).
- Keine unnötigen Dependencies hinzufügen.
- Kleine, gut verständliche Commits sind besser als ein riesiger „Alles drin“-Commit.
- Wenn du größere Änderungen planst:
  - vorab ein Issue eröffnen oder ein bestehendes diskutieren

---

## 🔀 Workflow für Pull Requests

1. Fork dieses Repository
2. Erstelle einen Branch für deine Änderung

git checkout -b feature/neues-feature

3. Änderungen vornehmen
4. Tests / Build ausführen

npm run compile
npm test

5. Committen

git commit -m "Beschreibe kurz deine Änderung"

6. Deinen Branch in deinen Fork pushen

git push origin feature/neues-feature

7. Auf GitHub einen Pull Request gegen `main` eröffnen.

Bitte beschreibe im PR:

- Was sich geändert hat
- Warum die Änderung sinnvoll ist
- Ggf. bekannte Einschränkungen

---

## ⚖️ Lizenz (GPLv3-or-later)

Dieses Projekt steht unter der GNU General Public License Version 3 oder später (GPLv3-or-later).

Indem du einen Beitrag einreichst, erklärst du dich damit einverstanden, dass:

- dein Beitrag unter der gleichen Lizenz veröffentlicht wird (GPLv3 oder später),
- du die Rechte an deinem Beitrag besitzt und ihn rechtlich weitergeben darfst,
- du keine Codefragmente einreichst, die Lizenzkonflikte verursachen.

Wenn du Drittanbieter-Code einbringen möchtest, kläre vorher im Issue, ob die Lizenz kompatibel ist.

---

## 🙏 Danke!

Vielen Dank, dass du dazu beiträgst, PEARL-Unterstützung in VS Code besser zu machen!
