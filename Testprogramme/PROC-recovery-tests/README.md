# PROC parser integration tests

Run each program separately in the full PEARL LSP. Check AST, diagnostics,
hover, and folding; all valid post-error blocks and NextTask nodes should survive.

- 00: valid procedure declaration, parameters, RETURNS, GLOBAL and RETURN.
- 01: duplicate parameter A; expected duplicate-declaration diagnostic.
- 02: DCL A conflicts with formal parameter A in the same PROC scope.
- 03: parameter A shadows the outer DCL A (permitted); no diagnostic.
- 04: missing formal parameter type; parser should recover at ')'.
- 05: missing RETURNS type; parser should recover at ')' and parse body.
- 06: missing procedure END; error at MODEND, module closure preserved.
- 07: missing ')' after RETURN expression, later BEGIN retained.
- 08: unclosed parameter list; recover at ';' and retain body.

Known limits: CALL, REF PROC, SPC ENTRY/PROC and expression semantics are not
part of this initial structural PROC slice. Function return-path and argument
compatibility checks are likewise not included.
