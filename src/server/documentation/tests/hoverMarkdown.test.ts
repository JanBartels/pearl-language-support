// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Jan Bartels

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SourceValue } from '../../core/sourceValue';
import { AlphicDationSystemDeclarationNode } from '../../ast/system/declarations/alphicDationSystemDeclationNode';
import { MacroDocumentationProvider } from '../macroDocumentationProvider';
import { md } from '../markdownUtils';
import { FileSource } from '../../source/fileSource';
import { NamedTypeNode } from '../../ast/problem/types/namedTypeNode';
import { CallStatementNode } from '../../ast/problem/statements/callStatementNode';
import { ReturnStatementDocumentationProvider } from '../problem/statements/returnStatementDocumentationProvider';

test('Markdown escapes punctuation in prose, not in inline code', () => {
    const text = md`Identifier ${'Long_Name'}; device \`${'/ED/My_File.txt.....'}\`.`;
    assert.equal(text, 'Identifier Long\\_Name; device `/ED/My_File.txt.....`.');
});

test('Markdown does not escape underscores or punctuation in fenced PEARL source', () => {
    const text = md`Example:\n\n\`\`\`pearl\n${'CALL My_Proc;'}\n\`\`\`\nEnd: ${'My_Proc'}`;
    assert.equal(text, 'Example:\n\n```pearl\nCALL My_Proc;\n```\nEnd: My\\_Proc');
});

test('SYSTEM filename hover keeps source path and identifier intact', () => {
    const sv = <T>(value: T) => SourceValue.synthetic(value);
    const path = '/ED/My_File_1.txt................';
    const node = new AlphicDationSystemDeclarationNode(
        sv('File_Device'), sv(path), sv('->'), undefined, sv(false), undefined, undefined
    );
    const provider = node.documentationProvider();
    const documentation = provider.getDocumentation(node, { node, element: node.systemName });
    assert.ok(documentation?.includes(`**\`${path}\`**`));
    assert.ok(!documentation?.includes('\\.'));
    assert.ok(!documentation?.includes('\\_'));
    const nameDocumentation = provider.getDocumentation(node, { node, element: node.name });
    assert.ok(nameDocumentation?.includes('**`File_Device`**'));
});

test('Macro hover code block keeps underscores unescaped', () => {
    const documentation = MacroDocumentationProvider.getDocumentation({
        location: {
            source: new FileSource('file:///test.pearl', 'My_Macro'),
            span: { start: 0, end: 8 }
        },
        definition: { name: 'My_Macro', replacement: 'MY_PROC_1' }
    });
    assert.ok(documentation.includes('#define My_Macro MY_PROC_1'));
    assert.ok(!documentation.includes('\\_'));
});

test('Named type hover leaves the underscore inside the inline code span', () => {
    const node = new NamedTypeNode(SourceValue.synthetic('Control_Type_1'));
    const markdown = node.documentationProvider().getDocumentation(node, {
        node, element: node.name
    });
    assert.ok(markdown?.includes('`Control_Type_1`'));
    assert.ok(!markdown?.includes('Control\\_Type'));
});

test('CALL hover escapes the identifier in a heading without altering display', () => {
    const target = SourceValue.synthetic('My_Proc_1');
    const node = new CallStatementNode(SourceValue.synthetic('CALL'), target, undefined);
    const markdown = node.documentationProvider().getDocumentation(node, { node, element: target });
    assert.ok(markdown?.startsWith('# Prozeduraufruf My\\_Proc\\_1'));
});
