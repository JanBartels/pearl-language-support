// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { fileURLToPath, pathToFileURL } from 'url';
import * as path from 'path';

/**
 * Konvertiert eine LSP-URI in einen Dateisystem-Pfad.
 * Fällt auf die URI selbst zurück, wenn sie kein file:// ist.
 */
export function filePathFromUri(uri: string): string {
  if (isFileUri(uri)) {
    try {
      return fileURLToPath(uri);
    } catch {
      return uri;
    }
  }
  return uri;
}

/**
 * Konvertiert einen absoluten Dateisystem-Pfad in eine file:// URI.
 */
export function uriFromFilePath(absPath: string): string {
  return pathToFileURL(absPath).toString();
}

/**
 * Normalisiert einen Dateipfad für konsistente Vergleiche.
 * (Wichtig unter Windows)
 */
export function normalizeFsPath(fsPath: string): string {
  return path.normalize(fsPath);
}

/**
 * Prüft, ob eine URI eine file:// URI ist.
 */
export function isFileUri(uri: string): boolean {
  return uri.startsWith('file://');
}

/**
 * Gibt das Verzeichnis einer URI zurück.
 */
export function directoryFromUri(uri: string): string {
  const fsPath = filePathFromUri(uri);
  return path.dirname(fsPath);
}

/**
 * Prüft, ob childUri unter parentUri liegt.
 * Wichtig für Multi-Root-Workspaces.
 */
export function isSubUri(parentUri: string, childUri: string): boolean {
  let parent = parentUri.endsWith('/') ? parentUri : parentUri + '/';
  return childUri.startsWith(parent);
}
