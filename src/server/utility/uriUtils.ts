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
 * Projects a Node-generated file URI into the serialization used by VS Code's
 * Uri.toString() for a Windows drive. VS Code emits `file:///c%3A/...` while
 * node:url emits `file:///C:/...`. Both identify the same file, but the LSP
 * registry and include provenance use URI strings as keys.
 *
 * Only the Windows drive prefix is rewritten. Never lowercase the rest of a
 * path: individual Windows directories can be case-sensitive. UNC and POSIX
 * URIs are unchanged, as are existing %-escapes in file names.
 *
 * Exported separately so Windows behavior can be regression-tested on Linux.
 */
export function fileUriForLsp(fileUri: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== 'win32') return fileUri;
  return fileUri.replace(/^file:\/\/\/([A-Za-z]):(?=\/|$)/, (_match, drive: string) =>
    `file:///${drive.toLowerCase()}%3A`
  );
}

/**
 * Konvertiert einen absoluten Dateisystem-Pfad in eine file:// URI.
 * The resulting Windows URI matches the VS Code client's serialization.
 */
export function uriFromFilePath(absPath: string): string {
  return fileUriForLsp(pathToFileURL(absPath).toString());
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
