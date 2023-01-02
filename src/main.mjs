import { $, fs, chalk, sleep } from 'zx';
import { config } from 'dotenv';

export default async function postCreate() {
  console.log(chalk.blue('Starting devcontainer...'));

  //////////////////////////////////////////////////////////////////////////////////
  // CONSTANTS
  //////////////////////////////////////////////////////////////////////////////////

  const SRC = process.env.SRC;
  const HOME = process.env.HOME;

  //////////////////////////////////////////////////////////////////////////////////
  // CONFIG
  //////////////////////////////////////////////////////////////////////////////////

  const {
    GCP_PROJECT_NAME,
    EXPORT_PROJECT_ENV = 'false',
    INSTALL_DEV_DEPENDENCIES = 'false',
    RESET_LIVE_RUN = 'false',
    SET_NPM_CREDENTIALS = 'false',
    SET_GCP_CREDENTIALS = 'false',
    SET_GAM_CREDENTIALS = 'false',
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

  await $`npm install ${SRC}`;
  await $`npm update`;

  //////////////////////////////////////////////////////////////////////////////////
  // INSTALL RUN (PRODUCTION)
  //////////////////////////////////////////////////////////////////////////////////

  await $`npm install -g @ghostmind-dev/run`;
  const run = `${HOME}/.npm-global/bin/run`;
  await $`export PATH=${HOME}/.npm-global/bin:$PATH`;

  //////////////////////////////////////////////////////////////////////////////////
  // VAULT LOGIN
  //////////////////////////////////////////////////////////////////////////////////

  await $`vault login ${process.env.VAULT_ROOT_TOKEN}`;

  //////////////////////////////////////////////////////////////////////////////////
  // SET PROJECT ENVIRONMENT VARIABLES
  //////////////////////////////////////////////////////////////////////////////////

  if (EXPORT_PROJECT_ENV === 'true') {
    await $`${run} vault kv export`;
  }

  const { config } = await import(`${SRC}/node_modules/dotenv/lib/main.js`);

  config({ path: `${SRC}/.env` });

  //////////////////////////////////////////////////////////////////////////////////
  // SET NPM CREDENTIALS
  //////////////////////////////////////////////////////////////////////////////////

  if (SET_NPM_CREDENTIALS === 'true') {
    const NPMRC_INSTALL = process.env.NPMRC_INSTALL;
    const NPMRC_PUBLISH = process.env.NPMRC_PUBLISH;
    await $`echo ${NPMRC_INSTALL} | base64 -di -w 0 >${HOME}/.npmrc`;
    await $`echo ${NPMRC_PUBLISH} | base64 -di -w 0 >${SRC}/.npmrc`;
  }

  // /////////////////////////////////////////////////////////////////////////////////
  // // GCP
  // ////////////////////////////////////////////////////////////////////////////////

  if (SET_GCP_CREDENTIALS) {
    const GCP_SERVICE_ACCOUNT_ADMIN = process.env.GCP_SERVICE_ACCOUNT_ADMIN;
    const GCP_SERVICE_ACCOUNT_RUN = process.env.GCP_SERVICE_ACCOUNT_RUN;

    $.shell = '/usr/bin/zsh';

    try {
      $.verbose = false;

      await $`echo ${GCP_SERVICE_ACCOUNT_ADMIN} | base64 -di -w 0 >/tmp/gsa_key.json`;
      await $`echo ${GCP_SERVICE_ACCOUNT_RUN} | base64 -di -w 0 >/tmp/service_account_run_key.json`;

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

  if (SET_GAM_CREDENTIALS === 'true') {
    const GAM_OAUTH2CLIENT = process.env.GAM_OAUTH2CLIENT;
    const GAM_CLIENTSECRETS = process.env.GAM_CLIENTSECRETS;
    const GAM_OAUTH2TXT = process.env.GAM_OAUTH2TXT;

    await $`echo ${GAM_OAUTH2CLIENT} | base64 -di -w 0 >/home/vscode/bin/gam/oauth2service.json`;
    await $`echo ${GAM_CLIENTSECRETS} | base64 -di -w 0 >/home/vscode/bin/gam/client_secrets.json`;
    await $`echo ${GAM_OAUTH2TXT} | base64 -di -w 0 >/home/vscode/bin/gam/oauth2.txt`;
  }

  //////////////////////////////////////////////////////////////////////////////////
  // DOTFILES
  //////////////////////////////////////////////////////////////////////////////////

  const dotfilesFolder = fs.readdirSync(`${process.env.HOME}`);

  if (!dotfilesFolder.includes('.dotfiles')) {
    await $`git clone https://github.com/ghostmind-dev/dotfiles.git ${HOME}/.dotfiles`;
    await $`rcup -d ${HOME}/.dotfiles -x Readme.md -x .gitignore -f`;
  }

  // ////////////////////////////////////////////////////////////////////////////////
  // // INSTALL APP DEPENDENCIES
  // ////////////////////////////////////////////////////////////////////////////////

  if (INSTALL_DEV_DEPENDENCIES === 'true') {
    await $`${run} utils dev install`;
  }

  // //////////////////////////////////////////////////////////////////////////////////
  // // INSTALL LIVE RUN
  // //////////////////////////////////////////////////////////////////////////////////

  if (RESET_LIVE_RUN === 'true') {
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

  await $`echo "export ENVIRONMENT=${environemnt}" > ${HOME}/.zshenv`;
}
