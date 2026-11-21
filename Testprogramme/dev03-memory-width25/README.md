# 0.3.2 - 32-bit module memory settings (package 25)

Open this folder in the Extension Development Host. `Main.P` has no invalid-width diagnostics.

1. Replace `SC=$00002000` with `SC=$123456789`: an error for the module size should appear. Revert.
2. Replace `CODE=$FA0000` with `CODE=$123456789`: an error for CODE should appear. Revert.
3. Replace `VAR=$3000` with `VAR=012345678`: an error for VAR should appear. Revert.
4. Replace `/*+R=$FFFFFFFF reserve working memory */` with `/*+R=$FFFFFFFFF reserve working memory */`: an LSP warning for a too-wide R control comment should appear. Revert.
5. Change `/*+R=` to `/*-R` with the eight-digit value: no width warning should appear.

Module settings are checked semantically. The R-control comment is separately checked by the existing compiler-control comment analyzer, without adding a PEARL AST node.
