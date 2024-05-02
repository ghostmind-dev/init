#!/usr/bin/env -S deno run --allow-all

import { $, fs, chalk, sleep, cd, echo } from 'npm:zx';
import { config } from 'npm:dotenv';
import { createStructuredOutputRunnable } from 'npm:langchain/chains/openai_functions';
import { ChatOpenAI } from 'npm:@langchain/openai';
import { ChatPromptTemplate } from 'npm:@langchain/core/prompts';
import { JsonOutputFunctionsParser } from 'npm:langchain/output_parsers';
import figlet from 'npm:figlet';

import {
  setColorEnabled,
  green,
  blue,
} from 'https://deno.land/std/fmt/colors.ts';

$.verbose = true;

console.log(chalk.blue('Starting devcontainer...'));

// //////////////////////////////////////////////////////////////////////////////////
// // CONSTANTS
// //////////////////////////////////////////////////////////////////////////////////

const HOME = Deno.env.get('HOME');
const SRC = Deno.env.get('SRC');

const {
  INIT_EXPORT_ENV_PROJECT = 'false',
  INIT_EXPORT_ENV_ALL = 'false',
  INIT_DEV_INSTALL_DEPENDENCIES = 'false',
  INIT_DEV_RESET_LIVE = 'false',
  INIT_LOGIN_NPM = 'false',
  INIT_LOGIN_GCP = 'false',
  INIT_LOGIN_GAM = 'false',
  INIT_LOGIN_VAULT = 'false',
  INIT_LOGIN_CLOUDFLARED = 'false',
  INIT_SSH_MODE = 'false',
  INIT_QUOTE_AI = 'false',
} = Deno.env.toObject();

//////////////////////////////////////////////////////////////////////////////////
// NPM GITHUB REGISTRY
//////////////////////////////////////////////////////////////////////////////////

await $`mkdir -p ${HOME}/.npm-global`;
await $`npm config set prefix ${HOME}/.npm-global`;
await $`npm config set update-notifier false`;
await $`export PATH=${HOME}/.npm-global/bin:$PATH`;

//////////////////////////////////////////////////////////////////////////////////
// CHECK PROJECT META.JSON
//////////////////////////////////////////////////////////////////////////////////

const metaconfig: any = await fs.readJson(`${SRC}/meta.json`);

//////////////////////////////////////////////////////////////////////////////////
// NPM PROJECT MODULES
//////////////////////////////////////////////////////////////////////////////////

const fileExists = await fs.exists(`${SRC}/package.json`);

if (fileExists) {
  await $`npm install ${SRC}`;
  await $`npm update`;
}

//////////////////////////////////////////////////////////////////////////////////
// INSTALL RUN (PRODUCTION)
//////////////////////////////////////////////////////////////////////////////////

await $`rm -rf ${HOME}/run`;
await $`git clone https://github.com/ghostmind-dev/run.git ${HOME}/run`;
await $`deno install --allow-all --force --name run ${HOME}/run/run/bin/cmd.ts`;
const run = `${HOME}/.deno/bin/run`;

//////////////////////////////////////////////////////////////////////////////////
// SET DENO.JSON
//////////////////////////////////////////////////////////////////////////////////

const defaultDenoCOnfigRaw = await fetch(
  'https://raw.githubusercontent.com/ghostmind-dev/dotfiles/main/config/deno/deno.json'
);

let defaultDenoConfig = await defaultDenoCOnfigRaw.json();

let mergedDenoConfig = { ...defaultDenoConfig };

if (metaconfig.deno?.config?.lint) {
  mergedDenoConfig = { ...mergedDenoConfig, ...metaconfig.deno.config.lint };
}

await fs.writeJson(`${HOME}/deno.json`, mergedDenoConfig, { spaces: 2 });

//////////////////////////////////////////////////////////////////////////////////
// NPM GLOBAL MODULES (TO BE MOVED TO DVC)
//////////////////////////////////////////////////////////////////////////////////

if (INIT_SSH_MODE === 'true') {
  config({ path: `${SRC}/.env` });
}

//////////////////////////////////////////////////////////////////////////////////
// VAULT LOGIN
//////////////////////////////////////////////////////////////////////////////////
if (INIT_LOGIN_VAULT === 'true') {
  await $`vault login ${Deno.env.get('VAULT_ROOT_TOKEN')}`;
  if (INIT_EXPORT_ENV_PROJECT === 'true') {
    await $`${run} vault kv export`;
  }
  if (INIT_EXPORT_ENV_ALL === 'true') {
    await $`${run} vault kv export --all`;
  }
}

//////////////////////////////////////////////////////////////////////////////////
// SET GLOBAL SECRETS
//////////////////////////////////////////////////////////////////////////////////

await $`rm -rf /tmp/env.global.json`;

await $`vault kv get -format=json kv/GLOBAL/global/secrets  > /tmp/env.global.json`;

const credsValue = await fs.readJSONSync(`/tmp/env.global.json`);

const { CREDS } = credsValue.data.data;

await $`rm -rf ${HOME}/.zprofile`;
fs.writeFileSync(`${HOME}/.zprofile`, CREDS, 'utf8');

config({ path: `${HOME}/.zprofile`, override: false });

//////////////////////////////////////////////////////////////////////////////////
// SET PROJECT ENVIRONMENT VARIABLES
//////////////////////////////////////////////////////////////////////////////////

config({ path: `${SRC}/.env`, override: false });

//////////////////////////////////////////////////////////////////////////////////
// SET NPM CREDENTIALS
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_NPM === 'true') {
  const NPM_TOKEN = Deno.env.get('NPM_TOKEN');

  await $`rm -rf ${SRC}/.npmrc`;
  await $`rm -rf ${HOME}/.npmrc`;

  await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${SRC}/.npmrc`;
  await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${HOME}/.npmrc`;
}
/////////////////////////////////////////////////////////////////////////////////
// GCP
////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_GCP === 'true') {
  const GCP_SERVICE_ACCOUNT_ADMIN = Deno.env.get('GCP_SERVICE_ACCOUNT_ADMIN');
  $.shell = '/usr/bin/zsh';
  const GCP_PROJECT_NAME = Deno.env.get('GCP_PROJECT_NAME');
  try {
    $.verbose = false;
    await $`echo ${GCP_SERVICE_ACCOUNT_ADMIN} | base64 -di -w 0 >/tmp/gsa_key.json`;
    $.verbose = true;
    await $`gcloud auth activate-service-account --key-file="/tmp/gsa_key.json"`;
    const isProjectExists =
      await $`gcloud projects list --filter="${GCP_PROJECT_NAME}"`;
    if (`${isProjectExists}` != '') {
      await $`gcloud config set project ${GCP_PROJECT_NAME}`;
      await $`gcloud config set compute/zone us-central1-b`;
      await $`gcloud auth configure-docker gcr.io --quiet`;
    }
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong');
  }
  await sleep(2000);
}
// //////////////////////////////////////////////////////////////////////////////////
// // GAM
// //////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_GAM === 'true') {
  const GAM_OAUTH2CLIENT = Deno.env.get('GAM_OAUTH2CLIENT');
  const GAM_CLIENTSECRETS = Deno.env.get('GAM_CLIENTSECRETS');
  const GAM_OAUTH2TXT = Deno.env.get('GAM_OAUTH2TXT');
  await $`echo ${GAM_OAUTH2CLIENT} | base64 -di -w 0 >/home/vscode/bin/gam/oauth2service.json`;
  await $`echo ${GAM_CLIENTSECRETS} | base64 -di -w 0 >/home/vscode/bin/gam/client_secrets.json`;
  await $`echo ${GAM_OAUTH2TXT} | base64 -di -w 0 >/home/vscode/bin/gam/oauth2.txt`;
}
//////////////////////////////////////////////////////////////////////////////////
// GIT SAFE
//////////////////////////////////////////////////////////////////////////////////

cd(`${SRC}`);

await $`git config --add safe.directory "*"`;
//
//////////////////////////////////////////////////////////////////////////////////
// DOTFILES
//////////////////////////////////////////////////////////////////////////////////

await $`curl -o ${HOME}/.zshrc https://raw.githubusercontent.com/ghostmind-dev/dotfiles/main/config/zsh/.zshrc`;

////////////////////////////////////////////////////////////////////////////////
// INSTALL APP DEPENDENCIES
////////////////////////////////////////////////////////////////////////////////
if (INIT_DEV_INSTALL_DEPENDENCIES === 'true') {
  await $`${run} utils dev install`;
}
//////////////////////////////////////////////////////////////////////////////////
// INSTALL LIVE RUN
//////////////////////////////////////////////////////////////////////////////////
if (INIT_DEV_RESET_LIVE === 'true') {
  await $`rm -rf ${SRC}/dev`;
  await $`git clone https://github.com/ghostmind-dev/run.git ${SRC}/dev`;
  await $`deno install --allow-all --force --name live ${SRC}/dev/run/bin/cmd.ts`;

  // get deno.json and replace a property and write it back

  const denoConfig = await fs.readJson(`${HOME}/deno.json`);

  // replace compilerOptions.types with a new array

  denoConfig.compilerOptions.types = [`${SRC}/dev/run/types/global.d.ts`];

  await fs.writeJson(`${HOME}/deno.json`, denoConfig, { spaces: 2 });
}

//////////////////////////////////////////////////////////////////////////////////
// SET CLOUDFLARED
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_CLOUDFLARED === 'true') {
  const CLOUDFLARED_CREDS = Deno.env.get('CLOUDFLARED_CREDS');
  $.shell = '/usr/bin/zsh';

  try {
    $.verbose = false;
    await $`mkdir -p /home/vscode/.cloudflared`;
    await $`echo ${CLOUDFLARED_CREDS} | base64 -di -w 0 > /home/vscode/.cloudflared/cert.pem`;
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong');
  }
  await sleep(2000);
}

//////////////////////////////////////////////////////////////////////////////////
//  SET DEVCONTAINER DEV ENVIRONMENT
//////////////////////////////////////////////////////////////////////////////////

$.verbose = false;

const currentBranchRaw = await $`git branch --show-current`;
// trim the trailing newline
const currentBranch = currentBranchRaw.stdout.trim();
let environemnt;
if (currentBranch === 'main') {
  environemnt = 'prod';
} else if (currentBranch === 'preview') {
  environemnt = 'preview';
} else {
  environemnt = 'dev';
}
$.verbose = true;
// set environment name in zshenv
await $`echo "export ENV=${environemnt}" > ${HOME}/.zshenv`;

////////////////////////////////////////////////////////////////////////////////
// CONNECT TO GHCR.IO
////////////////////////////////////////////////////////////////////////////////

await $`echo ${Deno.env.get(
  'GH_TOKEN'
)} | docker login ghcr.io -u USERNAME --password-stdin`;

////////////////////////////////////////////////////////////////////////////////
// WELCOME TO GHOSTMIND DEVCONTAINWER
////////////////////////////////////////////////////////////////////////////////

console.log(figlet.textSync('Welcome to Ghostmind', { font: 'Standard' }));

////////////////////////////////////////////////////////////////////////////////
// QUOTE OF THE DAY
////////////////////////////////////////////////////////////////////////////////

if (INIT_QUOTE_AI === 'true') {
  const jsonSchema = {
    title: 'quote',
    description: 'a random quote/facts about the computer science.',
    type: 'object',
    properties: {
      quote: {
        title: 'quote',
        description: 'A random quote/facts about the computer science.',
        type: 'string',
      },
    },
    required: ['quote'],
  };

  const model = new ChatOpenAI({
    temperature: 1.4,
    topP: 0.9,
  });

  // fetch json from url

  const subjectRaw = await fetch(
    'https://gist.githubusercontent.com/komondor/49f517bb271b1da1ca7d7c5ff86f024d/raw/89c7f927214f2476765959edcf666fa178cdf275/subjects.json'
  );

  const subjects = await subjectRaw.json();

  const subject = subjects[Math.floor(Math.random() * subjects.length)];

  const typesRaw = await fetch(
    'https://gist.githubusercontent.com/komondor/49f517bb271b1da1ca7d7c5ff86f024d/raw/89c7f927214f2476765959edcf666fa178cdf275/types.json'
  );

  const types = await typesRaw.json();

  const type = types[Math.floor(Math.random() * types.length)];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      'human',
      `Generate a random quote/facts about the computer science.

    Subject: ${subject}
    Type: ${type}

    `,
    ],
  ]);

  const outputParser = new JsonOutputFunctionsParser();

  // Also works with Zod schema
  const runnable = createStructuredOutputRunnable({
    outputSchema: jsonSchema,
    llm: model,
    prompt,
    outputParser,
  });

  const response: any = await runnable.invoke({});

  // Enable color output
  setColorEnabled(true);

  // Print "Welcome" in green

  console.log(green('The quote of this rebuild is:'), response.quote, '\n');
}

////////////////////////////////////////////////////////////////////////////////
// THE END
////////////////////////////////////////////////////////////////////////////////
