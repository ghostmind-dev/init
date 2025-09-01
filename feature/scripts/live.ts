import type { CustomArgs, CustomOptions } from 'jsr:@ghostmind/run';
import { $ } from 'npm:zx@8.1.3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

export default async function (args: CustomArgs, opts: CustomOptions) {
  $.verbose = true;

  // Define source paths
  const featureSourceDir = path.join(opts.currentPath, 'feature', 'src');
  const devcontainerSourcePath = path.join(
    featureSourceDir,
    '.devcontainer',
    'devcontainer.json'
  );
  const featureJsonPath = path.join(
    featureSourceDir,
    'devcontainer-feature.json'
  );

  const installShPath = path.join(featureSourceDir, 'install.sh');

  // Verify source files exist
  if (!fs.existsSync(featureSourceDir)) {
    console.error(`❌ Feature directory not found: ${featureSourceDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(devcontainerSourcePath)) {
    console.error(
      `❌ DevContainer config not found: ${devcontainerSourcePath}`
    );
    process.exit(1);
  }

  if (!fs.existsSync(featureJsonPath)) {
    console.error(`❌ Feature JSON not found: ${featureJsonPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(installShPath)) {
    console.error(`❌ Install script not found: ${installShPath}`);
    process.exit(1);
  }

  // Create temporary directory
  const randomName = Math.random().toString(36).substring(2, 15);
  const tempDir = path.join('/tmp', `devcontainer-live-${randomName}`);
  const tempDevcontainerDir = path.join(tempDir, '.devcontainer');
  const tempFeatureDir = path.join(tempDevcontainerDir, 'feature');

  console.log(`📁 Creating temporary directory: ${tempDir}`);

  // Create directory structure
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(tempDevcontainerDir, { recursive: true });
  fs.mkdirSync(tempFeatureDir, { recursive: true });

  // Copy files
  console.log('📄 Copying DevContainer configuration...');
  fs.copyFileSync(
    devcontainerSourcePath,
    path.join(tempDevcontainerDir, 'devcontainer.json')
  );

  console.log('📄 Copying feature files...');
  fs.copyFileSync(
    featureJsonPath,
    path.join(tempFeatureDir, 'devcontainer-feature.json')
  );
  fs.copyFileSync(installShPath, path.join(tempFeatureDir, 'install.sh'));

  // Make install.sh executable
  fs.chmodSync(path.join(tempFeatureDir, 'install.sh'), 0o755);

  console.log('✅ Temporary environment setup complete');
  console.log(`📍 Temp directory: ${tempDir}`);

  // Change to temporary directory and run devcontainer up
  process.chdir(tempDir);
  console.log('🔧 Running devcontainer up...');

  try {
    const result = await $`devcontainer up --workspace-folder ${tempDir}`;

    // Extract container ID from the output
    const output = result.stdout;
    console.log('📋 DevContainer output:', output);

    console.log('🔍 Getting container information...');

    // Run docker ps to get the container details
    const dockerPsResult =
      await $`docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}" --latest`;
    console.log('🐳 Docker containers:');
    console.log(dockerPsResult.stdout);

    // Get just the container name from the latest container
    const dockerPsNameResult =
      await $`docker ps --format "{{.Names}}" --latest`;
    const containerName = dockerPsNameResult.stdout.trim();

    if (containerName) {
      console.log(`🎉 DevContainer started successfully!`);
      console.log(`📦 Container Name: ${containerName}`);
      console.log(`📁 Workspace: ${tempDir}`);
      console.log(`🔗 You can now connect to this container in VS Code/Cursor`);
      console.log(`💻 Connect with one of these methods:`);
      console.log(`   1. devcontainer open ${tempDir}`);
      console.log(`   2. code --remote=containers+${containerName}`);
      console.log(
        `   3. Open VS Code and use "Dev Containers: Attach to Running Container"`
      );

      // Ask if user wants to auto-open
      if (opts.has('open')) {
        console.log(`🚀 Auto-opening container in VS Code...`);
        await $`devcontainer open ${tempDir}`;
      } else {
        console.log(`💡 Tip: Add --open flag to auto-open the container`);
      }

      return containerName;
    } else {
      console.log(
        '✅ DevContainer started, but container name could not be retrieved'
      );
      console.log('📋 Full output above contains the details');
    }
  } catch (error) {
    console.error('❌ Failed to start DevContainer:', error);
    console.log(`🗑️ You may want to clean up: rm -rf ${tempDir}`);
    process.exit(1);
  }
}
