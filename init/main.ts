#!/usr/bin/env -S deno run --allow-all

import { $, fs, chalk, sleep, cd } from 'npm:zx@8.6.1';
import { config } from 'npm:dotenv@17.0.1';
import process from 'node:process';
// LangChain imports - will be loaded dynamically if needed
import figlet from 'npm:figlet@1.8.1';
import Table from 'npm:cli-table3@0.6.3';

//////////////////////////////////////////////////////////////////////////////////
// CONSTANTS
//////////////////////////////////////////////////////////////////////////////////

const HOME = Deno.env.get('HOME');
const SRC = Deno.env.get('SRC');

// Control verbosity based on debug mode
const INIT_DEBUG_MODE = Deno.env.get('INIT_DEBUG_MODE');
$.verbose = INIT_DEBUG_MODE === 'true';

// In production mode, suppress all output except our status messages
if (INIT_DEBUG_MODE !== 'true') {
  // Redirect stdout and stderr to suppress all command output
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;

  process.stdout.write = function (chunk: any) {
    // Only allow our specific status messages through
    if (
      typeof chunk === 'string' &&
      (chunk.includes('🚀 Starting routine') ||
        chunk.includes('┌') ||
        chunk.includes('└') ||
        chunk.includes('├') ||
        chunk.includes('│') || // Table borders
        (chunk.includes('✓') && !chunk.includes('$')) ||
        (chunk.includes('✗') && !chunk.includes('$')) ||
        (chunk.includes('-') &&
          !chunk.includes('$') &&
          !chunk.includes('dotenv')) ||
        chunk.includes('Welcome to Ghostmind') ||
        chunk.includes('Activated service account') || // Allow GCP success messages
        chunk.includes('Updated property') || // Allow GCP config messages
        chunk.includes('__        __') || // ASCII art lines
        chunk.includes(' \\ \\      / ') ||
        chunk.includes('  \\ \\ /\\ / ') ||
        chunk.includes('   \\ V  V ') ||
        chunk.includes('    \\_/\\_/'))
    ) {
      return originalStdout.call(this, chunk);
    }
    return true;
  };

  process.stderr.write = function (chunk: any) {
    // Allow gcloud stderr output in production mode
    if (
      typeof chunk === 'string' &&
      (chunk.includes('gcloud') ||
        chunk.includes('WARNING') ||
        chunk.includes('ERROR') ||
        chunk.includes('service account'))
    ) {
      return originalStderr.call(this, chunk);
    }
    // Otherwise suppress stderr in production mode
    return true;
  };
}

if (INIT_DEBUG_MODE === 'true') {
  Deno.env.set('INIT_RUN_INSTALL', 'false');
  Deno.env.set('INIT_RESET_LIVE', 'true');
  Deno.env.set('INIT_BASE_ZSHRC', 'true');
  Deno.env.set('INIT_DENO_CONFIG', 'false');
  Deno.env.set('INIT_CORE_SECRETS', 'false');
  Deno.env.set('INIT_LOGIN_NPM', 'false');
  Deno.env.set('INIT_LOGIN_GCP', 'true');
  Deno.env.set('INIT_LOGIN_GHCR', 'true');
  Deno.env.set('INIT_LOGIN_VAULT', 'true');
  Deno.env.set('INIT_LOGIN_CLOUDFLARE', 'false');
  Deno.env.set('INIT_PYTHON_VERSION', '3.12.7');
  Deno.env.set('INIT_TMUX_CONFIG', 'false');
}

const {
  INIT_RUN_INSTALL = 'true',
  INIT_RESET_LIVE = 'false',
  INIT_BASE_ZSHRC = 'true',
  INIT_DENO_CONFIG = 'true',
  INIT_CORE_SECRETS = 'true',
  INIT_LOGIN_NPM = 'false',
  INIT_LOGIN_GCP = 'true',
  INIT_LOGIN_GHCR = 'true',
  INIT_LOGIN_VAULT = 'true',
  INIT_LOGIN_CLOUDFLARE = 'true',
  INIT_PYTHON_VERSION = '3.12.7',
  INIT_TMUX_CONFIG = 'true',
} = Deno.env.toObject();

// Track all steps and their statuses
const steps: Array<{
  name: string;
  status: 'pending' | 'in_progress' | 'success' | 'skipped' | 'failed';
  error?: string;
}> = [];

// Initialize steps based on environment variables
function initializeSteps() {
  steps.push(
    { name: 'Init', status: 'pending' },
    {
      name: 'Install Run (Production)',
      status: INIT_RUN_INSTALL === 'true' ? 'pending' : 'skipped',
    },
    {
      name: 'Configure Deno',
      status: INIT_DENO_CONFIG === 'true' ? 'pending' : 'skipped',
    },
    {
      name: 'Vault Login',
      status: INIT_LOGIN_VAULT === 'true' ? 'pending' : 'skipped',
    },
    {
      name: 'Set Global Secrets',
      status: INIT_CORE_SECRETS === 'true' ? 'pending' : 'skipped',
    },
    { name: 'Fix NPM Permissions', status: 'pending' },
    {
      name: 'NPM Login',
      status: INIT_LOGIN_NPM === 'true' ? 'pending' : 'skipped',
    },
    {
      name: 'GCP Login',
      status: INIT_LOGIN_GCP === 'true' ? 'pending' : 'skipped',
    },
    { name: 'Configure Git Safe Directory', status: 'pending' },
    {
      name: 'Configure ZSH & Dotfiles',
      status: INIT_BASE_ZSHRC === 'true' ? 'pending' : 'skipped',
    },
    {
      name: 'Install Live Run',
      status:
        INIT_RESET_LIVE === 'true'
          ? 'pending'
          : INIT_RESET_LIVE === 'false'
          ? 'pending'
          : 'skipped',
    },
    { name: `Set Python Version (${INIT_PYTHON_VERSION})`, status: 'pending' },
    {
      name: 'Cloudflare Login',
      status: INIT_LOGIN_CLOUDFLARE === 'true' ? 'pending' : 'skipped',
    },
    { name: 'Setup Docker Credentials', status: 'pending' },
    {
      name: 'GitHub Container Registry Login',
      status: INIT_LOGIN_GHCR === 'true' ? 'pending' : 'skipped',
    },
    {
      name: 'Configure Tmux',
      status: INIT_TMUX_CONFIG === 'true' ? 'pending' : 'skipped',
    }
  );
}

// Function to render the final table with all statuses
function renderTable() {
  const table = new Table({
    head: [chalk.gray('Step'), chalk.gray('Status')],
    colWidths: [50, 20],
    style: {
      head: [],
      border: ['grey'],
    },
  });

  for (const step of steps) {
    let statusColor = '';
    switch (step.status) {
      case 'pending':
        statusColor = chalk.gray('⋯ Pending');
        break;
      case 'in_progress':
        statusColor = chalk.yellow('⟳ In Progress');
        break;
      case 'success':
        statusColor = chalk.green('✓ Complete');
        break;
      case 'skipped':
        statusColor = chalk.gray('- Skipped');
        break;
      case 'failed':
        statusColor = chalk.red('✗ Failed');
        break;
    }
    table.push([step.name, statusColor]);
  }

  console.log('\n' + table.toString() + '\n');

  // Show errors for failed steps
  for (const step of steps) {
    if (step.status === 'failed' && step.error) {
      console.error(chalk.red(`  ${step.name}: ${step.error}`));
    }
  }
}

// Function to show sequential step progress
function showStepProgress(
  stepName: string,
  status: 'success' | 'skipped' | 'failed'
) {
  if (INIT_DEBUG_MODE === 'true') return;

  let statusIcon = '';
  switch (status) {
    case 'success':
      statusIcon = chalk.green('✓');
      break;
    case 'skipped':
      statusIcon = chalk.gray('○');
      break;
    case 'failed':
      statusIcon = chalk.red('✗');
      break;
  }

  // Clean list format for production
  console.log(`${statusIcon} ${stepName}`);
}

// Function to update step status
async function updateStep(
  stepName: string,
  status: 'in_progress' | 'success' | 'skipped' | 'failed',
  error?: string
) {
  const step = steps.find((s) => s.name === stepName);
  if (step) {
    step.status = status;
    if (error) step.error = error;

    // Show step progress in production mode (only on completion)
    if (INIT_DEBUG_MODE !== 'true' && status !== 'in_progress') {
      // Add a delay for sequential visual effect
      await sleep(300);
      showStepProgress(stepName, status);
    }
  }
}

// Initialize steps tracking
initializeSteps();

// Show initial message in production mode
if (INIT_DEBUG_MODE !== 'true') {
  console.log(chalk.cyan('\n🚀 Starting routine...\n'));

  // Show first init step
  await sleep(300);
  showStepProgress('Init', 'success');
}

//////////////////////////////////////////////////////////////////////////////////
// INSTALL RUN (PRODUCTION)
//////////////////////////////////////////////////////////////////////////////////

// Mark init as completed after initial setup
if (INIT_DEBUG_MODE === 'true') {
  // In debug mode, just mark it as completed without showing table row
  const initStep = steps.find((s) => s.name === 'Init');
  if (initStep) initStep.status = 'success';
}

if (INIT_RUN_INSTALL === 'true') {
  updateStep('Install Run (Production)', 'in_progress');
  try {
    await $`rm -rf ${HOME}/run`;
    await $`git clone https://github.com/ghostmind-dev/run.git ${HOME}/run`;
    await $`deno install --allow-all --force --global --name run ${HOME}/run/run/bin/cmd.ts`;
    await updateStep('Install Run (Production)', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    await updateStep('Install Run (Production)', 'failed', errorMessage);
  }
} else {
  await updateStep('Install Run (Production)', 'skipped');
}

//////////////////////////////////////////////////////////////////////////////////
// SET DENO.JSON
//////////////////////////////////////////////////////////////////////////////////

if (INIT_DENO_CONFIG === 'true') {
  updateStep('Configure Deno', 'in_progress');
  try {
    const defaultDenoCOnfigRaw = await fetch(
      'https://raw.githubusercontent.com/ghostmind-dev/config/main/config/deno/deno.json'
    );

    const defaultDenoConfig = await defaultDenoCOnfigRaw.json();

    await fs.writeJson(`${HOME}/deno.json`, defaultDenoConfig, { spaces: 2 });
    await updateStep('Configure Deno', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    await updateStep('Configure Deno', 'failed', errorMessage);
  }
} else {
  await updateStep('Configure Deno', 'skipped');
}

//////////////////////////////////////////////////////////////////////////////////
// VAULT LOGIN
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_VAULT === 'true') {
  updateStep('Vault Login', 'in_progress');
  try {
    await $`vault login ${Deno.env.get('VAULT_TOKEN')}`;
    await updateStep('Vault Login', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    await updateStep('Vault Login', 'failed', errorMessage);
  }
} else {
  await updateStep('Vault Login', 'skipped');
}

//////////////////////////////////////////////////////////////////////////////////
// SET GLOBAL SECRETS
//////////////////////////////////////////////////////////////////////////////////

if (INIT_CORE_SECRETS === 'true') {
  updateStep('Set Global Secrets', 'in_progress');
  try {
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

    // Suppress dotenv output in production mode
    if (INIT_DEBUG_MODE === 'true') {
      config({ path: `${HOME}/.zprofile`, override: false });
    } else {
      // Load environment variables silently
      try {
        const envContent = await Deno.readTextFile(`${HOME}/.zprofile`);
        const lines = envContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=');
              Deno.env.set(key, value);
            }
          }
        }
      } catch (e) {
        // Silent fail if file doesn't exist
      }
    }
    updateStep('Set Global Secrets', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    updateStep('Set Global Secrets', 'failed', errorMessage);
  }
} else {
  updateStep('Set Global Secrets', 'skipped');
}

//////////////////////////////////////////////////////////////////////////////////
// FIX NPM PERMISSIONS
//////////////////////////////////////////////////////////////////////////////////

// Always fix npm permissions to prevent EACCES errors during global installs
updateStep('Fix NPM Permissions', 'in_progress');
try {
  // Fix ownership of npm cache directory
  await $`sudo chown -R 1000:1000 "${HOME}/.npm" 2>/dev/null || true`;

  // Fix ownership of npm global directory if it exists
  const npmGlobalPath = `${HOME}/.npm-global`;
  if (await fs.exists(npmGlobalPath)) {
    await $`sudo chown -R 1000:1000 "${npmGlobalPath}" 2>/dev/null || true`;
  }

  // Clean npm cache to remove any corrupted files
  await $`npm cache clean --force 2>/dev/null || true`;

  updateStep('Fix NPM Permissions', 'success');
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  updateStep('Fix NPM Permissions', 'failed', errorMessage);
}

//////////////////////////////////////////////////////////////////////////////////
// SET NPM CREDENTIALS
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_NPM === 'true') {
  updateStep('NPM Login', 'in_progress');
  try {
    const NPM_TOKEN = Deno.env.get('NPM_TOKEN');

    await $`rm -rf ${SRC}/.npmrc`;
    await $`rm -rf ${HOME}/.npmrc`;

    await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${SRC}/.npmrc`;
    await $`echo //registry.npmjs.org/:_authToken=${NPM_TOKEN} >${HOME}/.npmrc`;

    updateStep('NPM Login', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    updateStep('NPM Login', 'failed', errorMessage);
  }
} else {
  updateStep('NPM Login', 'skipped');
}

/////////////////////////////////////////////////////////////////////////////////
// GCP
////////////////////////////////////////////////////////////////////////////////

const GCP_SERVICE_ACCOUNT_JSON = Deno.env.get('GCP_SERVICE_ACCOUNT_JSON');

// Debug: console.log(GCP_SERVICE_ACCOUNT_JSON);

if (INIT_LOGIN_GCP === 'true') {
  if (GCP_SERVICE_ACCOUNT_JSON && GCP_SERVICE_ACCOUNT_JSON.trim() !== '') {
    updateStep('GCP Login', 'in_progress');

    // In production mode, keep commands quiet but allow error handling
    const originalVerbose = $.verbose;
    if (INIT_DEBUG_MODE === 'true') {
      $.verbose = true;
    } else {
      $.verbose = false; // Keep commands quiet in production
    }

    try {
      $.shell = '/usr/bin/zsh';
      const GCP_PROJECT_NAME = Deno.env.get('GCP_PROJECT_NAME');

      // Validate the service account JSON before writing
      if (!GCP_SERVICE_ACCOUNT_JSON || GCP_SERVICE_ACCOUNT_JSON.trim() === '') {
        throw new Error(
          'GCP_SERVICE_ACCOUNT_JSON environment variable is empty'
        );
      }

      // Clean and validate the JSON
      let cleanedJson = GCP_SERVICE_ACCOUNT_JSON.trim();

      // Remove outer quotes if they exist (common issue with environment variables)
      if (
        (cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) ||
        (cleanedJson.startsWith("'") && cleanedJson.endsWith("'"))
      ) {
        cleanedJson = cleanedJson.slice(1, -1);
      }

      // Handle escaped quotes
      cleanedJson = cleanedJson.replace(/\\"/g, '"');

      // Try to parse the JSON to validate it
      let parsedJson;
      try {
        parsedJson = JSON.parse(cleanedJson);
      } catch (parseError) {
        if (INIT_DEBUG_MODE === 'true') {
          console.log(
            'Raw GCP_SERVICE_ACCOUNT_JSON (first 100 chars):',
            GCP_SERVICE_ACCOUNT_JSON.substring(0, 100)
          );
          console.log(
            'Cleaned JSON (first 100 chars):',
            cleanedJson.substring(0, 100)
          );
        }
        throw new Error(
          `Invalid JSON in GCP_SERVICE_ACCOUNT_JSON: ${
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
          }`
        );
      }

      // Validate it's a service account key
      if (!parsedJson.type || parsedJson.type !== 'service_account') {
        throw new Error(
          'GCP_SERVICE_ACCOUNT_JSON does not appear to be a valid service account key (missing or incorrect "type" field)'
        );
      }

      // Write the service account key to file
      await fs.writeFile('/tmp/gsa_key.json', cleanedJson);

      // Verify the file was created and has content
      const fileExists = await fs.exists('/tmp/gsa_key.json');
      if (!fileExists) {
        throw new Error('Failed to create service account key file');
      }

      // Check file size to ensure it's not empty
      const fileInfo = await Deno.stat('/tmp/gsa_key.json');
      if (fileInfo.size === 0) {
        throw new Error('Service account key file was created but is empty');
      }

      // Set proper permissions on the key file
      await $`chmod 600 /tmp/gsa_key.json`;

      if (INIT_DEBUG_MODE === 'true') {
        console.log('Service account key file created successfully');
        console.log(`File size: ${fileInfo.size} bytes`);
        await $`cat /tmp/gsa_key.json`;
      }
      // In production mode, no additional logging to keep output clean

      // Set GOOGLE_APPLICATION_CREDENTIALS environment variable
      Deno.env.set('GOOGLE_APPLICATION_CREDENTIALS', '/tmp/gsa_key.json');

      // Make GOOGLE_APPLICATION_CREDENTIALS persistent in shell sessions
      await $`echo "export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gsa_key.json" >> ${HOME}/.zshenv`;

      // Activate the service account
      await $`gcloud auth activate-service-account --key-file="/tmp/gsa_key.json"`;

      if (GCP_PROJECT_NAME && GCP_PROJECT_NAME.trim() !== '') {
        // First try to use GCP_PROJECT_NAME as project ID directly
        let projectId = GCP_PROJECT_NAME;

        try {
          // Test if it's a valid project ID by trying to set it
          await $`gcloud config set project ${projectId}`;
        } catch (projectError) {
          // If that fails, try to find the project ID by name
          try {
            const projectCheckResult =
              await $`gcloud projects list --filter="name:${GCP_PROJECT_NAME}" --format="value(projectId)"`;
            const foundProjectId = projectCheckResult.stdout.trim();

            if (foundProjectId) {
              projectId = foundProjectId;
              await $`gcloud config set project ${projectId}`;
            } else {
              throw new Error(
                `Project with name "${GCP_PROJECT_NAME}" not found`
              );
            }
          } catch (listError) {
            throw new Error(
              `Failed to find or set project "${GCP_PROJECT_NAME}": ${
                listError instanceof Error
                  ? listError.message
                  : String(listError)
              }`
            );
          }
        }

        await $`gcloud config set compute/zone us-central1-b`;
        await $`gcloud auth configure-docker gcr.io --quiet`;

        // Restore original settings
        $.verbose = originalVerbose;
        updateStep('GCP Login', 'success');
      } else {
        // No project name provided, just activate service account
        $.verbose = originalVerbose;
        updateStep('GCP Login', 'success');
      }
    } catch (e) {
      // Restore original settings
      $.verbose = originalVerbose;

      console.error('GCP Login error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      updateStep('GCP Login', 'failed', errorMessage);
    }
  } else {
    updateStep('GCP Login', 'skipped');
  }
} else {
  updateStep('GCP Login', 'skipped');
}

//////////////////////////////////////////////////////////////////////////////////
// GIT SAFE
//////////////////////////////////////////////////////////////////////////////////

updateStep('Configure Git Safe Directory', 'in_progress');
try {
  cd(`${SRC}`);

  const cursorServerPath = `${HOME}/.cursor-server`;

  if (await fs.exists(cursorServerPath)) {
    await $`git config --add safe.directory "*"`;
    updateStep('Configure Git Safe Directory', 'success');
  } else {
    updateStep('Configure Git Safe Directory', 'skipped');
  }
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  updateStep('Configure Git Safe Directory', 'failed', errorMessage);
}

//////////////////////////////////////////////////////////////////////////////////
// DOTFILES
//////////////////////////////////////////////////////////////////////////////////

if (INIT_BASE_ZSHRC === 'true') {
  updateStep('Configure ZSH & Dotfiles', 'in_progress');
  try {
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
      updateStep('Configure ZSH & Dotfiles', 'success');
    } else {
      let pluginsInstalled = true;

      // Install zsh-autosuggestions
      if (!(await fs.exists(`${ZSH_CUSTOM}/plugins/zsh-autosuggestions`))) {
        try {
          await $`git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM}/plugins/zsh-autosuggestions`;
        } catch (e) {
          pluginsInstalled = false;
        }
      }

      // Install zsh-syntax-highlighting
      if (!(await fs.exists(`${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting`))) {
        try {
          await $`git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM}/plugins/zsh-syntax-highlighting`;
        } catch (e) {
          pluginsInstalled = false;
        }
      }

      // Install zsh-completions
      if (!(await fs.exists(`${ZSH_CUSTOM}/plugins/zsh-completions`))) {
        try {
          await $`git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM}/plugins/zsh-completions`;
        } catch (e) {
          pluginsInstalled = false;
        }
      }

      if (pluginsInstalled) {
        updateStep('Configure ZSH & Dotfiles', 'success');
      } else {
        updateStep(
          'Configure ZSH & Dotfiles',
          'failed',
          'Some plugins failed to install'
        );
      }
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    updateStep('Configure ZSH & Dotfiles', 'failed', errorMessage);
  }
} else {
  updateStep('Configure ZSH & Dotfiles', 'skipped');
}

//////////////////////////////////////////////////////////////////////////////////
// INSTALL LIVE RUN
//////////////////////////////////////////////////////////////////////////////////
updateStep('Install Live Run', 'in_progress');
if (INIT_RESET_LIVE === 'true') {
  try {
    await $`rm -rf ${SRC}/dev`;
    await $`git clone -b dev --depth 1 --single-branch https://github.com/ghostmind-dev/run.git ${SRC}/dev`;
    await $`deno install --allow-all --force --reload --global --quiet --name live ${SRC}/dev/run/bin/cmd.ts`;
    updateStep('Install Live Run', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    updateStep('Install Live Run', 'failed', errorMessage);
  }
} else {
  try {
    const devExists = await fs.exists(`${SRC}/dev/run`);

    if (devExists) {
      await $`deno install --allow-all --force --reload --global --quiet --name live ${SRC}/dev/run/bin/cmd.ts`;
      updateStep('Install Live Run', 'success');
    } else {
      updateStep('Install Live Run', 'skipped');
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    updateStep('Install Live Run', 'failed', errorMessage);
  }
}

//////////////////////////////////////////////////////////////////////////////////
// PYTHON VERSION
//////////////////////////////////////////////////////////////////////////////////

updateStep(`Set Python Version (${INIT_PYTHON_VERSION})`, 'in_progress');
try {
  await $`pyenv global ${INIT_PYTHON_VERSION}`;
  updateStep(`Set Python Version (${INIT_PYTHON_VERSION})`, 'success');
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  updateStep(
    `Set Python Version (${INIT_PYTHON_VERSION})`,
    'failed',
    errorMessage
  );
}

//////////////////////////////////////////////////////////////////////////////////
// SET CLOUDFLARED
//////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_CLOUDFLARE === 'true') {
  updateStep('Cloudflare Login', 'in_progress');
  try {
    const CLOUDFLARED_CREDS = Deno.env.get('CLOUDFLARED_CREDS');
    $.shell = '/usr/bin/zsh';

    await $`mkdir -p /home/vscode/.cloudflared`;
    await $`echo ${CLOUDFLARED_CREDS} | base64 -di -w 0 > /home/vscode/.cloudflared/cert.pem`;

    updateStep('Cloudflare Login', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    updateStep('Cloudflare Login', 'failed', errorMessage);
  }
  await sleep(2000);
} else {
  updateStep('Cloudflare Login', 'skipped');
}

////////////////////////////////////////////////////////////////////////////////
// SETUP DOCKER CONFIG
////////////////////////////////////////////////////////////////////////////////

async function setupDockerConfig() {
  const dockerConfigPath = `${HOME}/.docker`;

  try {
    // Ensure the docker config directory exists
    await fs.ensureDir(dockerConfigPath);

    const configPath = `${dockerConfigPath}/config.json`;

    // Check if config already exists (may have been created by gcloud)
    if (await fs.exists(configPath)) {
      const existingConfig = await fs.readJSON(configPath);
      // Preserve existing auths (like GCR from gcloud) and ensure auths object exists
      if (!existingConfig.auths) {
        existingConfig.auths = {};
      }
      // Remove any credsStore setting that might cause issues with multiple registries
      delete existingConfig.credsStore;
      await fs.writeJson(configPath, existingConfig, { spaces: 2 });
    } else {
      // Create a basic config with empty auths object ready for registry logins
      const dockerConfig = {
        auths: {},
      };
      await fs.writeJson(configPath, dockerConfig, { spaces: 2 });
    }
  } catch (e) {
    // Silent fail - not critical
  }
}

// Docker config setup moved after GCP login to prevent gcloud from overwriting it

////////////////////////////////////////////////////////////////////////////////
// SETUP DOCKER CONFIG (after GCP to prevent gcloud from overwriting)
////////////////////////////////////////////////////////////////////////////////

updateStep('Setup Docker Credentials', 'in_progress');
try {
  await setupDockerConfig();
  updateStep('Setup Docker Credentials', 'success');
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  updateStep('Setup Docker Credentials', 'failed', errorMessage);
}

////////////////////////////////////////////////////////////////////////////////
// CONNECT TO GHCR.IO
////////////////////////////////////////////////////////////////////////////////

if (INIT_LOGIN_GHCR == 'true') {
  updateStep('GitHub Container Registry Login', 'in_progress');

  // Temporarily enable verbose mode for Docker login to see errors
  const originalVerbose = $.verbose;
  if (INIT_DEBUG_MODE !== 'true') {
    $.verbose = false; // Keep quiet but allow error detection
  }

  try {
    await $`echo $GH_TOKEN | docker login ghcr.io -u USERNAME --password-stdin`;

    updateStep('GitHub Container Registry Login', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log('GitHub Container Registry Login failed:', errorMessage);
    updateStep('GitHub Container Registry Login', 'failed', errorMessage);
  } finally {
    // Restore original verbose setting
    $.verbose = originalVerbose;
  }
} else {
  updateStep('GitHub Container Registry Login', 'skipped');
}

////////////////////////////////////////////////////////////////////////////////
// TMUX CONFIG
////////////////////////////////////////////////////////////////////////////////

if (INIT_TMUX_CONFIG == 'true') {
  updateStep('Configure Tmux', 'in_progress');
  try {
    await $`curl -o ${HOME}/.tmux.conf https://raw.githubusercontent.com/ghostmind-dev/config/refs/heads/main/config/tmux/.tmux.conf`;
    updateStep('Configure Tmux', 'success');
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    updateStep('Configure Tmux', 'failed', errorMessage);
  }
} else {
  updateStep('Configure Tmux', 'skipped');
}

////////////////////////////////////////////////////////////////////////////////
// PRINT FINAL TABLE (DEBUG MODE) AND WELCOME
////////////////////////////////////////////////////////////////////////////////

// Show final table only in debug mode
// Wait for all steps to complete, then show welcome
if (INIT_DEBUG_MODE === 'true') {
  renderTable();
} else {
  // Wait for any remaining async operations to complete
  await sleep(1000);

  // Add spacing before welcome in production mode
  console.log('');
}

////////////////////////////////////////////////////////////////////////////////
// WELCOME TO GHOSTMIND DEVCONTAINWER
////////////////////////////////////////////////////////////////////////////////

// Print welcome message with gradient-like colors
const welcomeText = figlet.textSync('Welcome to Ghostmind', {
  font: 'Standard',
});
const lines = welcomeText.split('\n');
lines.forEach((line: string, index: number) => {
  // Create a gradient effect from cyan to blue
  if (index % 2 === 0) {
    console.log(chalk.cyan(line));
  } else {
    console.log(chalk.blue(line));
  }
});

////////////////////////////////////////////////////////////////////////////////
// THE END
////////////////////////////////////////////////////////////////////////////////
