import type { CustomArgs, CustomOptions } from 'jsr:@ghostmind/run';
import { $ } from 'npm:zx';

export default async function (args: CustomArgs, opts: CustomOptions) {
  console.log('Test script started');
  const { has, extract, env } = opts;

  // Get the scenario from arguments (optional)
  let scenario: string | undefined = args[0];

  // Handle flags
  let verbose = has('verbose');
  let noCleanup = has('no-cleanup');
  let listScenarios = has('list-scenarios');
  let noCommonUtils = has('no-common-utils');

  // Also check if flags are passed as arguments (fallback)
  const remainingArgs = args.slice(0);
  remainingArgs.forEach((arg) => {
    if (arg === 'verbose') verbose = true;
    if (arg === 'no-cleanup') noCleanup = true;
    if (arg === 'list-scenarios') listScenarios = true;
    if (arg === 'no-common-utils') noCommonUtils = true;
  });

  // If the first argument is a flag, then no scenario was specified
  if (
    scenario &&
    (scenario === 'verbose' ||
      scenario === 'no-cleanup' ||
      scenario === 'list-scenarios' ||
      scenario === 'no-common-utils')
  ) {
    scenario = undefined;
  }

  const { currentPath, rootPath } = opts;

  // When --root=feature is used, rootPath contains the full path
  // Otherwise, if run from within feature directory, use currentPath
  let basePath: string;

  if (rootPath) {
    // rootPath is set when using --root option
    basePath = rootPath;
  } else if (currentPath.endsWith('/feature')) {
    // Already in the feature directory
    basePath = currentPath;
  } else {
    // Try to use feature subdirectory
    basePath = `${currentPath}/feature`;
  }

  // Debug output
  if (verbose) {
    console.log(`Current path: ${currentPath}`);
    console.log(`Root path: ${rootPath}`);
    console.log(`Base path: ${basePath}`);
  }

  // Check if the feature structure exists
  try {
    await Deno.stat(`${basePath}/src/devcontainer-feature.json`);
    await Deno.stat(`${basePath}/test/scenarios.json`);
  } catch (error) {
    console.error('❌ Invalid feature structure');
    console.log(`Looking in: ${basePath}`);
    console.log('Expected structure:');
    console.log('  - src/devcontainer-feature.json');
    console.log('  - src/install.sh');
    console.log('  - test/scenarios.json');
    console.log('  - test/test.sh');

    // Check what actually exists
    try {
      console.log('\nActual structure found:');
      for await (const entry of Deno.readDir(basePath)) {
        console.log(`  - ${entry.name}${entry.isDirectory ? '/' : ''}`);
      }
    } catch {}

    Deno.exit(1);
  }

  // Read feature name from devcontainer-feature.json
  let featureName: string;
  try {
    const featureConfigContent = await Deno.readTextFile(
      `${basePath}/src/devcontainer-feature.json`
    );
    const featureConfig = JSON.parse(featureConfigContent);
    featureName = featureConfig.id || 'feature';
  } catch {
    console.error('❌ Could not read feature configuration');
    Deno.exit(1);
  }

  // Check if scenarios.json exists
  const scenariosPath = `${basePath}/test/scenarios.json`;
  let scenarios: Record<string, any> = {};

  try {
    const scenariosContent = await Deno.readTextFile(scenariosPath);
    scenarios = JSON.parse(scenariosContent);
  } catch {
    console.error(`❌ No scenarios.json found`);
    console.log(`Expected: ${scenariosPath}`);
    Deno.exit(1);
  }

  // Show help if no arguments provided and not listing scenarios
  if (!scenario && !listScenarios) {
    console.log(`🧪 Testing feature: ${featureName}`);
    console.log('');
    console.log('Usage: run test [scenario] [options]');
    console.log('');
    console.log('Examples:');
    console.log(`  run test                    # Test all scenarios`);
    const firstScenario = Object.keys(scenarios)[0];
    if (firstScenario) {
      console.log(`  run test ${firstScenario}   # Test specific scenario`);
    }
    console.log(`  run test --list-scenarios   # List available scenarios`);
    console.log('');
    console.log('Options:');
    console.log('  --list-scenarios    List all available scenarios');
    console.log('  --verbose          Show detailed output');
    console.log('  --no-cleanup       Keep containers after test');
    console.log('  --no-common-utils  Skip installing common utilities');
    console.log('');
  }

  // List scenarios if requested
  if (listScenarios) {
    console.log(`📋 Available scenarios for '${featureName}':`);
    Object.keys(scenarios).forEach((scenarioName, index) => {
      const config = scenarios[scenarioName];
      console.log(`  ${index + 1}. ${scenarioName}`);
      console.log(`     Image: ${config.image}`);
      console.log(
        `     Features: ${JSON.stringify(config.features, null, 2).replace(
          /\n/g,
          '\n     '
        )}`
      );
      console.log('');
    });
    return;
  }

  // Determine which scenarios to test
  const scenariosToTest = scenario ? [scenario] : Object.keys(scenarios);

  if (scenario && !scenarios[scenario]) {
    console.error(`❌ Scenario '${scenario}' not found`);
    console.log('Available scenarios:');
    Object.keys(scenarios).forEach((name) => console.log(`  - ${name}`));
    Deno.exit(1);
  }

  console.log(`🧪 Testing feature '${featureName}'`);
  console.log(`📊 Scenarios to test: ${scenariosToTest.join(', ')}`);
  if (!noCommonUtils) {
    console.log('🔧 Common utilities will be installed automatically');
  }
  console.log('');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Test each scenario
  for (const scenarioName of scenariosToTest) {
    totalTests++;
    console.log(`🔍 Testing scenario: ${scenarioName}`);
    console.log(`📦 Image: ${scenarios[scenarioName].image}`);

    try {
      // Create temporary devcontainer.json for this test
      const tempDir = await Deno.makeTempDir({
        prefix: `devcontainer-test-${featureName}-`,
      });

      // Build features configuration with common-utils first (if not disabled)
      const features: Record<string, any> = {};

      if (!noCommonUtils) {
        // Add common-utils as the first feature to ensure basic tools are available
        features['ghcr.io/devcontainers/features/common-utils:2'] = {
          installZsh: true,
          installOhMyZsh: true,
          upgradePackages: true,
          username: 'automatic',
          uid: 'automatic',
          gid: 'automatic',
        };
      }

      // Read the feature's devcontainer-feature.json to get installsAfter dependencies
      const featureConfigPath = `${basePath}/src/devcontainer-feature.json`;
      try {
        const featureConfigContent = await Deno.readTextFile(featureConfigPath);
        const featureConfig = JSON.parse(featureConfigContent);

        // Add installsAfter dependencies
        if (
          featureConfig.installsAfter &&
          Array.isArray(featureConfig.installsAfter)
        ) {
          for (const dependency of featureConfig.installsAfter) {
            // Skip if already added (like common-utils)
            if (!features[dependency]) {
              features[dependency] = {};
              if (verbose) {
                console.log(`📦 Adding dependency: ${dependency}`);
              }
            }
          }
        }
      } catch (error: any) {
        if (verbose) {
          console.warn(
            `⚠️  Could not read feature config for installsAfter dependencies: ${
              error.message || error
            }`
          );
        }
      }

      // Add features from the scenario configuration (these can override dependencies)
      const scenarioFeatures = scenarios[scenarioName].features || {};
      for (const [featureKey, featureOptions] of Object.entries(
        scenarioFeatures
      )) {
        if (featureKey !== featureName) {
          features[featureKey] = featureOptions;
        }
      }

      // Add the feature being tested last (use relative path for local features)
      features[`./src`] = scenarios[scenarioName].features[featureName] || {};

      const devcontainerConfig = {
        name: `test-${featureName}-${scenarioName}`,
        image: scenarios[scenarioName].image,
        features: features,
        // Ensure we can run tests
        remoteUser: 'vscode',
        containerEnv: {
          // Pass feature options as environment variables for the test script
          ...Object.keys(
            scenarios[scenarioName].features[featureName] || {}
          ).reduce((env, key) => {
            const value = scenarios[scenarioName].features[featureName][key];
            env[key.toUpperCase()] =
              typeof value === 'boolean' ? value.toString() : value;
            return env;
          }, {} as Record<string, string>),
          // Set required environment variables for testing
          GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fake-credentials.json',
        },
      };

      // Create .devcontainer directory and config file
      const devcontainerDir = `${tempDir}/.devcontainer`;
      await Deno.mkdir(devcontainerDir, { recursive: true });

      // Copy the feature source files to .devcontainer directory
      const tempSrcDir = `${devcontainerDir}/src`;
      await Deno.mkdir(tempSrcDir, { recursive: true });

      // Copy all files from the src directory
      const featureSourceDir = `${basePath}/src`;
      for await (const entry of Deno.readDir(featureSourceDir)) {
        if (entry.isFile) {
          await Deno.copyFile(
            `${featureSourceDir}/${entry.name}`,
            `${tempSrcDir}/${entry.name}`
          );
        } else if (entry.isDirectory) {
          // Recursively copy directories (like .devcontainer)
          await copyDir(
            `${featureSourceDir}/${entry.name}`,
            `${tempSrcDir}/${entry.name}`
          );
        }
      }

      const configPath = `${devcontainerDir}/devcontainer.json`;
      await Deno.writeTextFile(
        configPath,
        JSON.stringify(devcontainerConfig, null, 2)
      );

      if (verbose) {
        console.log(`📄 Generated devcontainer.json:`);
        console.log(JSON.stringify(devcontainerConfig, null, 2));
        console.log('');
      }

      // Build and start the container
      console.log('🔨 Building container...');
      const upArgs = [
        'devcontainer',
        'up',
        '--workspace-folder',
        tempDir,
        '--log-level',
        verbose ? 'debug' : 'info',
      ];

      if (verbose) {
        console.log(`Running: ${upArgs.join(' ')}`);
      }

      await $`${upArgs}`;

      // Run the test
      console.log('🧪 Running feature test...');
      const testScript = `${basePath}/test/test.sh`;

      // Check if test script exists
      try {
        await Deno.stat(testScript);
      } catch {
        console.warn(
          `⚠️  No test script found at ${testScript}, skipping test execution`
        );
        console.log('✅ Build successful (no tests to run)');
        passedTests++;
        continue;
      }

      // Copy test script to temp directory
      await Deno.copyFile(testScript, `${tempDir}/test.sh`);

      // Run the test inside the container
      const testArgs = [
        'devcontainer',
        'exec',
        '--workspace-folder',
        tempDir,
        'bash',
        'test.sh',
      ];

      if (verbose) {
        console.log(`Running: ${testArgs.join(' ')}`);
      }

      try {
        const testResult = await $`${testArgs}`;

        if (verbose) {
          console.log('Test output:', testResult.stdout);
          if (testResult.stderr) {
            console.log('Test stderr:', testResult.stderr);
          }
        }

        console.log(`✅ Scenario '${scenarioName}' passed!`);
        passedTests++;
      } catch (testError: any) {
        // The test command failed - but let's check if it's because of the test or something else
        console.log(testError);
        console.error(`❌ Scenario '${scenarioName}' failed!`);
        if (verbose) {
          console.error('Full error:', testError);
          console.error('Exit code:', testError.exitCode);
          console.error('Stdout:', testError.stdout);
          console.error('Stderr:', testError.stderr);
        } else {
          // Show a truncated version of the output
          const output = testError.stdout || '';
          const lines = output.split('\n');
          const maxLines = 30;
          if (lines.length > maxLines) {
            console.error('Test output (truncated):');
            console.error(lines.slice(0, maxLines).join('\n'));
            console.error('...');
          } else {
            console.error('Test output:');
            console.error(output);
          }
        }
        failedTests++;
        continue;
      }

      // Cleanup unless --no-cleanup is specified
      if (!noCleanup) {
        console.log('🧹 Cleaning up...');
        try {
          await $`devcontainer down --workspace-folder ${tempDir}`;
        } catch (error: any) {
          if (verbose) {
            console.warn('Warning during cleanup:', error.message || error);
          }
        }
        await Deno.remove(tempDir, { recursive: true });
      } else {
        console.log(`📁 Test files preserved at: ${tempDir}`);
      }
    } catch (error: any) {
      // This catches build/setup errors
      console.error(`❌ Scenario '${scenarioName}' failed during setup!`);
      if (verbose) {
        console.error('Setup error details:', error);
      } else {
        console.error('Setup error:', error.message || error);
        console.log('💡 Use --verbose for detailed error information');
      }
      failedTests++;
    }

    console.log('');
  }

  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Total scenarios: ${totalTests}`);
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.log('');
    console.log('💡 Tips for debugging failures:');
    console.log('  - Use --verbose for detailed output');
    console.log('  - Use --no-cleanup to inspect generated files');
    console.log('  - Check the feature installation script and test script');
    console.log(
      '  - Use --no-common-utils if common utilities cause conflicts'
    );
    Deno.exit(1);
  } else {
    console.log('');
    console.log(`🎉 All tests passed for feature '${featureName}'!`);
  }
}

// Helper function to recursively copy directories
async function copyDir(src: string, dest: string) {
  await Deno.mkdir(dest, { recursive: true });
  for await (const entry of Deno.readDir(src)) {
    const srcPath = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;

    if (entry.isFile) {
      await Deno.copyFile(srcPath, destPath);
    } else if (entry.isDirectory) {
      await copyDir(srcPath, destPath);
    }
  }
}
