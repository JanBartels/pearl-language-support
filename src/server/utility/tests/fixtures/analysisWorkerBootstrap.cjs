// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels
// Development-only Worker bootstrap for running the unbundled TypeScript
// entrypoint under node:test. Production uses the esbuild worker bundle.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true
        }
    }).outputText;
    module._compile(js, filename);
};
require(path.join(__dirname, '..', '..', '..', 'analysisWorker.ts'));
