// const NODE_PATH = "/home/vscode/.npm-global/lib/node_modules";

import { $, fs, chalk, sleep } from 'zx';
import { config } from 'dotenv';

export async function postCreateCommand() {
  console.log(chalk.blue('Starting devcontainer...'));
  //////////////////////////////////////////////////////////////////////////////////
  // CONSTANTS
  //////////////////////////////////////////////////////////////////////////////////
  const HOME = process.env.HOME;
  const SRC = process.env.SRC;
  // need a funny name for naming my environment variables
  // INIT = devcontainer post create
  // but this is not funny or original
  // so I will use INIT = devcontainer post create
  // propose a better name if you have one
  // I will use it and give you credit
  // INIT = devcontainer post create
  //
  const {
    INIT_SRC = process.env.INIT_SRC,
    INIT_EXPORT_ENV_PROJECT = 'false',
    INIT_EXPORT_ENV_ALL = 'false',
    INIT_DEV_INSTALL_DEPENDENCIES = 'false',
    INIT_DEV_RESET_LIVE = 'false',
    INIT_LOGIN_NPM = 'false',
    INIT_LOGIN_GCP = 'false',
    INIT_LOGIN_GAM = 'false',
    INIT_LOGIN_VAULT = 'false',
  } = process.env;
  //////////////////////////////////////////////////////////////////////////////////
  // NPM GITHUB REGISTRY
  //////////////////////////////////////////////////////////////////////////////////
  await $`mkdir -p ${HOME}/.npm-global`;
  await $`npm config set prefix ${HOME}/.npm-global`;
  await $`npm config set update-notifier false`;
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

  await $`npm install -g @ghostmind-dev/run`;
  const run = `${HOME}/.npm-global/bin/run`;
  await $`export PATH=${HOME}/.npm-global/bin:$PATH`;

  //////////////////////////////////////////////////////////////////////////////////
  // NPM GLOBAL MODULES (TO BE MOVED TO DVC)
  //////////////////////////////////////////////////////////////////////////////////

  await $`npm install -g npm-run-all`;

  //////////////////////////////////////////////////////////////////////////////////
  // VAULT LOGIN
  //////////////////////////////////////////////////////////////////////////////////
  if (INIT_LOGIN_VAULT === 'true') {
    await $`vault login ${process.env.VAULT_ROOT_TOKEN}`;
    if (INIT_EXPORT_ENV_PROJECT === 'true') {
      await $`${run} vault kv export`;
    }
    if (INIT_EXPORT_ENV_ALL === 'true') {
      await $`${run} vault kv export --all`;
    }
  }
  //////////////////////////////////////////////////////////////////////////////////
  // SET PROJECT ENVIRONMENT VARIABLES
  //////////////////////////////////////////////////////////////////////////////////

  config({ path: `${SRC}/.env` });

  //////////////////////////////////////////////////////////////////////////////////
  // SET NPM CREDENTIALS
  //////////////////////////////////////////////////////////////////////////////////

  if (INIT_LOGIN_NPM === 'true') {
    const NPM_TOKEN = process.env.NPM_TOKEN;

    await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${SRC}/.npmrc`;
    await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${HOME}/.npmrc`;
  }
  /////////////////////////////////////////////////////////////////////////////////
  // GCP
  ////////////////////////////////////////////////////////////////////////////////
  if (INIT_LOGIN_GCP === 'true') {
    const GCP_SERVICE_ACCOUNT_ADMIN = process.env.GCP_SERVICE_ACCOUNT_ADMIN;
    $.shell = '/usr/bin/zsh';
    const GCP_PROJECT_NAME = process.env.GCP_PROJECT_NAME;
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
    const GAM_OAUTH2CLIENT = process.env.GAM_OAUTH2CLIENT;
    const GAM_CLIENTSECRETS = process.env.GAM_CLIENTSECRETS;
    const GAM_OAUTH2TXT = process.env.GAM_OAUTH2TXT;
    await $`echo ${GAM_OAUTH2CLIENT} | base64 -di -w 0 >/home/vscode/bin/gam/oauth2service.json`;
    await $`echo ${GAM_CLIENTSECRETS} | base64 -di -w 0 >/home/vscode/bin/gam/client_secrets.json`;
    await $`echo ${GAM_OAUTH2TXT} | base64 -di -w 0 >/home/vscode/bin/gam/oauth2.txt`;
  }
  //////////////////////////////////////////////////////////////////////////////////
  // GIT SAFE
  //////////////////////////////////////////////////////////////////////////////////
  process.chdir(SRC);
  await $`git config --add safe.directory "*"`;
  //////////////////////////////////////////////////////////////////////////////////
  // DOTFILES
  //////////////////////////////////////////////////////////////////////////////////

  await $`curl -o ${HOME}/.zshrc https://raw.githubusercontent.com/ghostmind-dev/dotfiles/main/config/zsh/.zshrc`;

  // ////////////////////////////////////////////////////////////////////////////////
  // // INSTALL APP DEPENDENCIES
  // ////////////////////////////////////////////////////////////////////////////////
  if (INIT_DEV_INSTALL_DEPENDENCIES === 'true') {
    await $`${run} utils dev install`;
  }
  // //////////////////////////////////////////////////////////////////////////////////
  // // INSTALL LIVE RUN
  // //////////////////////////////////////////////////////////////////////////////////
  if (INIT_DEV_RESET_LIVE === 'true') {
    await $`rm -rf ${SRC}/dev`;
    await $`git clone https://github.com/ghostmind-dev/run.git ${SRC}/dev`;
    await $`npm --prefix ${SRC}/dev  install`;
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
  await $`echo ${process.env.GH_TOKEN} | docker login ghcr.io -u USERNAME --password-stdin`;
  ////////////////////////////////////////////////////////////////////////////////
  // THE END
  ////////////////////////////////////////////////////////////////////////////////
}
