// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

/**
 * RTOS-UH shell-command ABI: the BIT(1) return value reports whether the
 * command succeeded.  See RTOS-UH, section 3.3, figure 3.3 (page 71).
 *
 * This is documentation for SHELLMODULE entry points, not the semantics of
 * ordinary procedures returning BIT(1).
 */
export const shellProcedureReturnStatusDocumentation =
    "**Shell-Rückgabecode (`BIT(1)`):** `'1'B` bedeutet Erfolg, "
    + "`'0'B` bedeutet Fehler. Die Shell berücksichtigt den Status "
    + "bei `WAIT` und bei mit `--` verketteten Folgebefehlen.";
