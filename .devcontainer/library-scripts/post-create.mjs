#!/usr/bin/env zx

const HOME = process.env.HOME;

await $`mkdir -p ${HOME}/.npm-global`;
await $`npm config set prefix ${HOME}/.npm-global`;
await $`npm config set update-notifier false`;

const NODE_PATH = "/home/vscode/.npm-global/lib/node_modules";

await $`npm install`;
await $`npm run build`;
await $`npm install --global ${process.env.SRC}`;

const { default: postCreate } = await import(
  `${NODE_PATH}/@ghostmind-dev/post-create/app/main.mjs`
);

await postCreate();
