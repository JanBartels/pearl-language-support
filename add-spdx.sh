#!/usr/bin/env bash
set -e

LICENSE_ID="GPL-3.0-or-later"
COPYRIGHT_LINE="Copyright (C) $(date +%Y) Jan Bartels"

HEADER="// SPDX-License-Identifier: ${LICENSE_ID}
// ${COPYRIGHT_LINE}
"

echo "Suche nach TypeScript-Dateien..."

find . -type f -name "*.ts" \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/out/*" \
| while read -r file; do

  if grep -q "SPDX-License-Identifier" "$file"; then
    echo "Überspringe (bereits SPDX): $file"
  else
    echo "Füge Header hinzu: $file"

    tmpfile=$(mktemp)

    # Header + Originalinhalt kombinieren
    printf "%s\n" "$HEADER" > "$tmpfile"
    cat "$file" >> "$tmpfile"

    mv "$tmpfile" "$file"
  fi

done

echo "Fertig."