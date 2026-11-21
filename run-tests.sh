#!/bin/bash
find src -name '*.test.ts' -print0 |   xargs -0 npx tsx --test
