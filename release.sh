#!/usr/bin/env bash
set -e

# Version aus package.json lesen
VERSION=$(jq -r '.version' package.json)

echo "Building VSIX for version $VERSION..."

# Tag erzeugen
git tag "v$VERSION"
git push origin "v$VERSION"

# VSIX bauen
vsce package

echo "Fertig! Datei erzeugt:"
echo "    pearl-language-support-$VERSION.vsix"
echo ""
echo "Jetzt im Browser unter GitHub → Releases hochladen:"
echo "https://github.com/JanBartels/pearl-language-support/releases"
