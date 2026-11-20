#!/bin/bash
find src/server -name '*.test.ts' -print0 |   xargs -0 npx tsx --test
