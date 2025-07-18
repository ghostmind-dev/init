#!/usr/bin/env -S deno run --allow-all

import { $, fs, chalk, sleep, cd } from 'npm:zx@8.6.1';
import { config } from 'npm:dotenv@17.0.1';
import { ChatOpenAI } from 'npm:@langchain/openai@0.5.18';
import { ChatPromptTemplate } from 'npm:@langchain/core@0.3.62/prompts';
import figlet from 'npm:figlet@1.8.1';

$.verbose = true;

console.log(chalk.blue('Starting devcontainer...'));

//////////////////////////////////////////////////////////////////////////////////
// CONSTANTS
//////////////////////////////////////////////////////////////////////////////////

const HOME = Deno.env.get('HOME');
const SRC = Deno.env.get('SRC');

// // debug mode

// Deno.env.set('INIT_RUN_INSTALL', 'false');
// Deno.env.set('INIT_RESET_LIVE', 'false');
// Deno.env.set('INIT_BASE_ZSHRC', 'false');
// Deno.env.set('INIT_DENO_CONFIG', 'false');
// Deno.env.set('INIT_DENO_JUPYTER', 'false');
// Deno.env.set('INIT_CORE_SECRETS', 'false');
// Deno.env.set('INIT_LOGIN_NPM', 'false');
// Deno.env.set('INIT_LOGIN_GCP', 'false');
// Deno.env.set('INIT_LOGIN_GHCR', 'false');
// Deno.env.set('INIT_LOGIN_NVCR', 'false');
// Deno.env.set('INIT_LOGIN_VAULT', 'false');
// Deno.env.set('INIT_LOGIN_CLOUDFLARE', 'false');
// Deno.env.set('INIT_PYTHON_VERSION', '3.9.7');
// Deno.env.set('INIT_RESET_DOCS', 'false');
// Deno.env.set('INIT_RESET_DOCS_NAME', 'refs');
// Deno.env.set('INIT_GLOBAL_RULES', 'false');
// Deno.env.set('INIT_DEVCONTAINER_SETTINGS', 'false');
// Deno.env.set('INIT_QUOTE_AI', 'false');

const {
  INIT_RUN_INSTALL = 'true',
  INIT_RESET_LIVE = 'false',
  INIT_BASE_ZSHRC = 'true',
  INIT_DENO_CONFIG = 'true',
  INIT_DENO_JUPYTER = 'false',
  INIT_CORE_SECRETS = 'true',
  INIT_LOGIN_NPM = 'false',
  INIT_LOGIN_GCP = 'true',
  INIT_LOGIN_GHCR = 'true',
  INIT_LOGIN_NVCR = 'true',
  INIT_LOGIN_VAULT = 'true',
  INIT_LOGIN_CLOUDFLARE = 'false',
  INIT_PYTHON_VERSION = '3.9.7',
  INIT_TMUX_CONFIG = 'false',
  INIT_GLOBAL_RULES = 'true',
  INIT_DEVCONTAINER_SETTINGS = 'false',
  INIT_QUOTE_AI = 'true',
} = Deno.env.toObject();

console.log(INIT_RESET_LIVE);

//////////////////////////////////////////////////////////////////////////////////
// INSTALL RUN (PRODUCTION)
//////////////////////////////////////////////////////////////////////////////////

if (INIT_RUN_INSTALL === 'true') {
  await $`rm -rf ${HOME}/run`;
  await $`git clone https://github.com/ghostmind-dev/run.git ${HOME}/run`;
  await $`deno install --allow-all --force --global --name run ${HOME}/run/run/bin/cmd.ts`;
}

//////////////////////////////////////////////////////////////////////////////////
// SET DENO.JSON
//////////////////////////////////////////////////////////////////////////////////

if (INIT_DENO_CONFIG === 'true') {
  const defaultDenoCOnfigRaw = await fetch(
    'https://raw.githubusercontent.com/ghostmind-dev/config/main/config/deno/deno.json'
  );

  const defaultDenoConfig = await defaultDenoCOnfigRaw.json();

  await fs.writeJson(`${HOME}/deno.json`, defaultDenoConfig, { spaces: 2 });
}

//////////////////////////////////////////////////////////////////////////////////
// SET VSCODE SETTINGS FROM DEVCONTAINER FEATURE
//////////////////////////////////////////////////////////////////////////////////

if (INIT_DEVCONTAINER_SETTINGS === 'true') {
  try {
    const settingsRaw = await fetch(
      'https://raw.githubusercontent.com/ghostmind-dev/config/main/config/vscode/settings.static.json'
    );

    const settings = await settingsRaw.json();

    // Detect IDE type and use appropriate settings path
    const cursorServerPath = `${HOME}/.cursor-server`;
    const vscodeServerPath = `${HOME}/.vscode-server`;

    let settingsPath;
    let ideName;

    if (await fs.exists(cursorServerPath)) {
      settingsPath = `${cursorServerPath}/data/Machine/settings.json`;
      ideName = 'Cursor';
    } else if (await fs.exists(vscodeServerPath)) {
      settingsPath = `${vscodeServerPath}/data/Machine/settings.json`;
      ideName = 'VS Code';
    } else {
      // Default to Cursor if neither exists (will create the directory structure)
      settingsPath = `${cursorServerPath}/data/Machine/settings.json`;
      ideName = 'Cursor (default)';
    }

    // Ensure the directory exists
    await fs.ensureDir(
      settingsPath.substring(0, settingsPath.lastIndexOf('/'))
    );

    await fs.writeJson(settingsPath, settings, { spaces: 2 });

    console.log(`${ideName} settings set at: ${settingsPath}`);
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with IDE settings.');
  }
}

//////////////////////////////////////////////////////////////////////////////////
// INSTALL DENO JUPYTER
//////////////////////////////////////////////////////////////////////////////////

if (INIT_DENO_JUPYTER === 'true') {
  await $`deno jupyter --install`;
}

//////////////////////////////////////////////////////////////////////////////////
// VAULT LOGIN
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_VAULT === 'true') {
  try {
    $.verbose = false;
    await $`vault login ${Deno.env.get('VAULT_TOKEN')}`;
    console.log('vault login successful.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with vault login.');
  }
}

//////////////////////////////////////////////////////////////////////////////////
// SET GLOBAL SECRETS
//////////////////////////////////////////////////////////////////////////////////

if (INIT_CORE_SECRETS === 'true') {
  try {
    $.verbose = false;
    await $`rm -rf /tmp/env.global.json`;

    await $`vault kv get -format=json kv/GLOBAL/global/secrets  > /tmp/env.global.json`;

    const credsValue = await fs.readJSONSync(`/tmp/env.global.json`);

    const { CREDS } = credsValue.data.data;

    await $`rm -rf ${HOME}/.zprofile`;
    await $`rm -rf ${HOME}/.zshenv`;

    fs.writeFileSync(`${HOME}/.zprofile`, CREDS, 'utf8');

    // we need to set the global secrets to the zshenv file
    // the difference: each variable is exported
    // only add the export if the line is not empty or not a comment

    await $`rm -rf ${HOME}/.zshenv`;

    await $`cat ${HOME}/.zprofile | grep -v '^#' | grep -v '^$' | while read -r line; do echo "export $line" >> ${HOME}/.zshenv; done`;

    config({ path: `${HOME}/.zprofile`, override: false });
    console.log('global secrets set.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with secrets setting.');
  }
}

//////////////////////////////////////////////////////////////////////////////////
// SET NPM CREDENTIALS
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_NPM === 'true') {
  try {
    $.verbose = false;

    const NPM_TOKEN = Deno.env.get('NPM_TOKEN');

    await $`rm -rf ${SRC}/.npmrc`;
    await $`rm -rf ${HOME}/.npmrc`;

    await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${SRC}/.npmrc`;
    await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${HOME}/.npmrc`;

    console.log('npm login successful.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with npm login.');
  }
}
/////////////////////////////////////////////////////////////////////////////////
// GCP
////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_GCP === 'true') {
  try {
    $.verbose = false;
    const GCP_SERVICE_ACCOUNT_JSON = Deno.env.get('GCP_SERVICE_ACCOUNT_JSON');
    $.shell = '/usr/bin/zsh';
    const GCP_PROJECT_NAME = Deno.env.get('GCP_PROJECT_NAME');

    await fs.writeFile('/tmp/gsa_key.json', GCP_SERVICE_ACCOUNT_JSON);

    // Set GOOGLE_APPLICATION_CREDENTIALS environment variable
    Deno.env.set('GOOGLE_APPLICATION_CREDENTIALS', '/tmp/gsa_key.json');

    // Make GOOGLE_APPLICATION_CREDENTIALS persistent in shell sessions
    await $`echo "export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gsa_key.json" >> ${HOME}/.zshenv`;

    await $`gcloud auth activate-service-account --key-file="/tmp/gsa_key.json"`;

    const isProjectExists =
      await $`gcloud projects list --filter="${GCP_PROJECT_NAME}"`;
    if (`${isProjectExists}` != '') {
      await $`gcloud config set project ${GCP_PROJECT_NAME}`;
      await $`gcloud config set compute/zone us-central1-b`;
      await $`gcloud auth configure-docker gcr.io --quiet`;
      console.log('gcp login successful.');
    } else {
      console.log(chalk.red('Project does not exists.'));
    }
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with gcp setup');
  }
}

//////////////////////////////////////////////////////////////////////////////////
// GIT SAFE
//////////////////////////////////////////////////////////////////////////////////

cd(`${SRC}`);

const cursorServerPath = `${HOME}/.cursor-server`;

if (await fs.exists(cursorServerPath)) {
  await $`git config --add safe.directory "*"`;
}

//////////////////////////////////////////////////////////////////////////////////
// DOTFILES
//////////////////////////////////////////////////////////////////////////////////

if (INIT_BASE_ZSHRC === 'true') {
  await $`curl -o ${HOME}/.zshrc https://raw.githubusercontent.com/ghostmind-dev/config/main/config/zsh/.zshrc`;
}

//////////////////////////////////////////////////////////////////////////////////
// INSTALL LIVE RUN
//////////////////////////////////////////////////////////////////////////////////
if (INIT_RESET_LIVE === 'true') {
  console.log('resetting live');
  await $`rm -rf ${SRC}/dev`;
  await $`git clone -b dev --depth 1 --single-branch https://github.com/ghostmind-dev/run.git ${SRC}/dev`;
  await $`deno install --allow-all --force --reload --global --name live ${SRC}/dev/run/bin/cmd.ts`;
} else {
  // verify if dev folder exists

  const devExists = await fs.exists(`${SRC}/dev/run`);

  if (devExists) {
    await $`deno install --allow-all --force --reload --global --name live ${SRC}/dev/run/bin/cmd.ts`;
  }
}

//////////////////////////////////////////////////////////////////////////////////
// PYTHON VERSION
//////////////////////////////////////////////////////////////////////////////////

await $`pyenv global ${INIT_PYTHON_VERSION}`;

//////////////////////////////////////////////////////////////////////////////////
// SET CLOUDFLARED
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_CLOUDFLARE === 'true') {
  try {
    $.verbose = false;

    const CLOUDFLARED_CREDS = Deno.env.get('CLOUDFLARED_CREDS');
    $.shell = '/usr/bin/zsh';

    await $`mkdir -p /home/vscode/.cloudflared`;
    await $`echo ${CLOUDFLARED_CREDS} | base64 -di -w 0 > /home/vscode/.cloudflared/cert.pem`;

    console.log('cloudflared login successful.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with cloudflared setup');
  }
  await sleep(2000);
}

////////////////////////////////////////////////////////////////////////////////
// CONNECT TO GHCR.IO
////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_GHCR == 'true') {
  try {
    $.verbose = false;
    await $`echo ${Deno.env.get(
      'GH_TOKEN'
    )} | docker login ghcr.io -u USERNAME --password-stdin`;

    console.log('ghcr login successful.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with ghcr login');
  }
}

////////////////////////////////////////////////////////////////////////////////
// TMUX CONFIG
////////////////////////////////////////////////////////////////////////////////

if (INIT_TMUX_CONFIG == 'true') {
  await $`curl -o ${HOME}/.tmux.conf https://raw.githubusercontent.com/ghostmind-dev/config/refs/heads/main/config/tmux/.tmux.config`;
}

////////////////////////////////////////////////////////////////////////////////
// CONNECT TO NVCR.IO
////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_NVCR == 'true') {
  try {
    $.verbose = false;
    await $`echo ${Deno.env.get(
      'NGC_TOKEN'
    )} | docker login nvcr.io -u \\$oauthtoken --password-stdin`;

    console.log('nvcr login successful.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with ghcr login');
  }
}

////////////////////////////////////////////////////////////////////////////////
// GLOBAL RULES
////////////////////////////////////////////////////////////////////////////////

if (INIT_GLOBAL_RULES === 'true') {
  try {
    $.verbose = false;

    // Create temporary directory for cloning
    const tempDir = '/tmp/ghostmind-docs';
    await $`rm -rf ${tempDir}`;

    // Clone the docs repository
    await $`git clone https://github.com/ghostmind-dev/docs.git ${tempDir}`;

    // Create target directory
    const targetDir = `${SRC}/.cursor/rules`;
    await $`mkdir -p ${targetDir}`;

    // Get all existing files in target directory to preserve non-matching ones
    const existingFiles = new Set();
    try {
      const existingFilesOutput =
        await $`find ${targetDir} -type f -name "*.mdc" -exec basename {} \\;`;
      existingFilesOutput.stdout
        .split('\n')
        .filter((f) => f.trim())
        .forEach((file) => {
          existingFiles.add(file.trim());
        });
    } catch (e) {
      // Directory might not exist or be empty, that's fine
    }

    // Copy all .mdc files from docs/rules to target directory
    const rulesSourceDir = `${tempDir}/docs/rules`;

    // Check if source directory exists
    const rulesExists = await fs.exists(rulesSourceDir);
    if (rulesExists) {
      // Get all .mdc files from source
      const sourceFiles =
        await $`find ${rulesSourceDir} -type f -name "*.mdc" -exec basename {} \\;`;
      const sourceFileList = sourceFiles.stdout
        .split('\n')
        .filter((f) => f.trim());

      // Copy each .mdc file
      for (const file of sourceFileList) {
        if (file.trim()) {
          await $`cp "${rulesSourceDir}/${file.trim()}" "${targetDir}/"`;
        }
      }

      console.log(`Copied ${sourceFileList.length} rule files to ${targetDir}`);
    } else {
      console.log('No rules directory found in the docs repository');
    }

    // Clean up temporary directory
    await $`rm -rf ${tempDir}`;

    console.log('Global rules setup completed successfully.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('Something went wrong with global rules setup');
  }
}

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

  // Use the modern withStructuredOutput method
  const structuredModel = model.withStructuredOutput(jsonSchema);

  const response: any = await structuredModel.invoke(await prompt.invoke({}));

  // Print "Welcome" in green using CSS styling

  console.log(
    '%cThe quote of this rebuild is:',
    'color: green',
    response.quote,
    '\n'
  );
}

////////////////////////////////////////////////////////////////////////////////
// THE END
////////////////////////////////////////////////////////////////////////////////
