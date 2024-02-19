#!/usr/bin/env node

import { postCreateCommand } from '../main.mjs';

const functionToRun = process.argv[2];

if (
  functionToRun === 'postCreateCommand' ||
  functionToRun === 'poat-create' ||
  functionToRun === 'postcreate'
) {
  await postCreateCommand();
}
