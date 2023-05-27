import { $, fs, chalk, sleep } from 'zx';
import { config } from 'dotenv';

export default async function postCreate() {
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
    INIT_SRC,
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

  if (INIT_LOGIN_VAULT === 'true') {
    await $`vault login ${process.env.VAULT_ROOT_TOKEN}`;
  }
  //////////////////////////////////////////////////////////////////////////////////
  // SET PROJECT ENVIRONMENT VARIABLES
  //////////////////////////////////////////////////////////////////////////////////

  if (INIT_EXPORT_ENV_PROJECT === 'true') {
    await $`${run} vault kv export`;
  }

  if (INIT_EXPORT_ENV_ALL === 'true') {
    await $`${run} vault kv export --all`;
  }

  const { config } = await import(`${SRC}/node_modules/dotenv/lib/main.js`);

  config({ path: `${SRC}/.env` });

  //////////////////////////////////////////////////////////////////////////////////
  // SET NPM CREDENTIALS
  //////////////////////////////////////////////////////////////////////////////////

  if (INIT_LOGIN_NPM === 'true') {
    const NPMRC_INSTALL = process.env.NPMRC_INSTALL;
    const NPMRC_PUBLISH = process.env.NPMRC_PUBLISH;
    await $`echo ${NPMRC_INSTALL} | base64 -di -w 0 >${HOME}/.npmrc`;
    await $`echo ${NPMRC_PUBLISH} | base64 -di -w 0 >${SRC}/.npmrc`;
  }

  // /////////////////////////////////////////////////////////////////////////////////
  // // GCP
  // ////////////////////////////////////////////////////////////////////////////////

  if (INIT_LOGIN_GCP === 'true') {
    const GCP_SERVICE_ACCOUNT_ADMIN = process.env.GCP_SERVICE_ACCOUNT_ADMIN;
    const GCP_SERVICE_ACCOUNT_RUN = process.env.GCP_SERVICE_ACCOUNT_RUN;

    $.shell = '/usr/bin/zsh';

    const GCP_PROJECT_NAME = process.env.GCP_PROJECT_NAME;

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

  if (INIT_LOGIN_GAM === 'true') {
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
}
