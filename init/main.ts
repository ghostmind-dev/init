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
// Deno.env.set('INIT_BASE_ZSHRC', 'true');
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
// Deno.env.set('INIT_TMUX_CONFIG', 'false');
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
  INIT_LOGIN_NVCR = 'false',
  INIT_LOGIN_VAULT = 'true',
  INIT_LOGIN_CLOUDFLARE = 'false',
  INIT_PYTHON_VERSION = '3.9.7',
  INIT_TMUX_CONFIG = 'true',
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

  // Configure ZSH theme and plugins from environment variables
  const INIT_ZSH_THEME = Deno.env.get('INIT_ZSH_THEME') || 'codespaces';
  const INIT_ZSH_PLUGINS =
    'zsh zsh-autosuggestions zsh-syntax-highlighting zsh-completions';

  // Set ZSH_THEME in .zshenv for persistence across sessions
  await $`echo 'export INIT_ZSH_THEME="${INIT_ZSH_THEME}"' >> ${HOME}/.zshenv`;

  // Set ZSH_PLUGINS in .zshenv if provided
  if (INIT_ZSH_PLUGINS) {
    await $`echo 'export INIT_ZSH_PLUGINS="${INIT_ZSH_PLUGINS}"' >> ${HOME}/.zshenv`;
  }

  // Install Oh My Zsh plugins
  const ZSH_CUSTOM = `${HOME}/.oh-my-zsh/custom`;

  // Ensure Oh My Zsh custom directory exists
  if (!(await fs.exists(ZSH_CUSTOM))) {
    console.log(
      chalk.yellow(
        'Warning: Oh My Zsh custom directory not found. Make sure Oh My Zsh is installed.'
      )
    );
  } else {
    console.log('Installing Oh My Zsh plugins...');

    // Install zsh-autosuggestions
    if (!(await fs.exists(`${ZSH_CUSTOM}/plugins/zsh-autosuggestions`))) {
      console.log('Installing zsh-autosuggestions...');
      try {
        await $`git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions`;
        console.log('zsh-autosuggestions installed successfully');
      } catch (e) {
        console.log(chalk.red('Failed to install zsh-autosuggestions'));
      }
    }

    // Install zsh-syntax-highlighting
    if (!(await fs.exists(`${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting`))) {
      console.log('Installing zsh-syntax-highlighting...');
      try {
        await $`git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting`;
        console.log('zsh-syntax-highlighting installed successfully');
      } catch (e) {
        console.log(chalk.red('Failed to install zsh-syntax-highlighting'));
      }
    }

    // Install zsh-completions
    if (!(await fs.exists(`${ZSH_CUSTOM}/plugins/zsh-completions`))) {
      console.log('Installing zsh-completions...');
      try {
        await $`git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM}/plugins/zsh-completions`;
        console.log('zsh-completions installed successfully');
      } catch (e) {
        console.log(chalk.red('Failed to install zsh-completions'));
      }
    }

    console.log('Oh My Zsh plugins installation completed');
  }
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
// SETUP DOCKER CREDENTIAL HELPER
////////////////////////////////////////////////////////////////////////////////

async function setupDockerCredentialHelper() {
  const dockerConfigPath = Deno.env.get('DOCKER_CONFIG') || `${HOME}/.docker`;

  try {
    // Ensure the docker config directory exists
    await fs.ensureDir(dockerConfigPath);

    // Create a config that doesn't store credentials persistently
    // We use an empty auths object and avoid setting credsStore
    const dockerConfig = {
      auths: {},
    };

    const configPath = `${dockerConfigPath}/config.json`;

    // Check if config already exists
    if (await fs.exists(configPath)) {
      const existingConfig = await fs.readJSON(configPath);
      // Keep existing config but ensure auths is clean
      if (!existingConfig.auths) {
        existingConfig.auths = {};
      }
      // Remove any credsStore setting that might cause issues
      delete existingConfig.credsStore;
      await fs.writeJson(configPath, existingConfig, { spaces: 2 });
    } else {
      await fs.writeJson(configPath, dockerConfig, { spaces: 2 });
    }
  } catch (e) {
    console.log(
      chalk.yellow('Note: Could not configure Docker credential helper')
    );
  }
}

// Helper function to clean Docker credentials after login
async function cleanDockerCredentials() {
  const dockerConfigPath = Deno.env.get('DOCKER_CONFIG') || `${HOME}/.docker`;
  const configPath = `${dockerConfigPath}/config.json`;

  try {
    if (await fs.exists(configPath)) {
      const config = await fs.readJSON(configPath);
      // Keep the config but clear the auths to prevent storing credentials
      config.auths = {};
      await fs.writeJson(configPath, config, { spaces: 2 });
    }
  } catch (e) {
    // Silent fail - not critical
  }
}

await setupDockerCredentialHelper();

////////////////////////////////////////////////////////////////////////////////
// CONNECT TO GHCR.IO
////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_GHCR == 'true') {
  try {
    $.verbose = false;

    await $`echo ${Deno.env.get(
      'GH_TOKEN'
    )} | docker login ghcr.io -u USERNAME --password-stdin 2>/dev/null || true`;

    // Clean credentials after login to prevent storage warning
    await cleanDockerCredentials();

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
  await $`curl -o ${HOME}/.tmux.conf https://raw.githubusercontent.com/ghostmind-dev/config/refs/heads/main/config/tmux/.tmux.conf`;
}

////////////////////////////////////////////////////////////////////////////////
// CONNECT TO NVCR.IO
////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_NVCR == 'true') {
  try {
    $.verbose = false;

    await $`echo ${Deno.env.get(
      'NGC_TOKEN'
    )} | docker login nvcr.io -u \\$oauthtoken --password-stdin 2>/dev/null || true`;

    // Clean credentials after login to prevent storage warning
    await cleanDockerCredentials();

    console.log('nvcr login successful.');
  } catch (e) {
    console.log(chalk.red(e));
    console.log('something went wrong with nvcr login');
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
