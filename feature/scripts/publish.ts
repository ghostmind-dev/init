import type { CustomArgs, CustomOptions } from 'jsr:@ghostmind/run';
import { $ } from 'npm:zx@8.1.3';

export default async function (args: CustomArgs, opts: CustomOptions) {
  $.verbose = true;

  const { env } = opts;
  const registry = 'ghcr.io';
  const namespace = 'ghostmind-dev/init';

  // Get the feature name from arguments (optional)

  // Get all feature directories

  const feature = 'init';

  const featurePath = './feature/src';

  const featureConfigPath = `${featurePath}/devcontainer-feature.json`;

  const featureConfigText = await Deno.readTextFile(featureConfigPath);
  const featureConfig = JSON.parse(featureConfigText);
  const version = featureConfig.version || '1.0.0';
  const name = featureConfig.name || 'init';

  console.log(`   📋 ${name} v${version}`);
  console.log(`   Target: ${registry}/${namespace}/init:${version}`);

  // Publish with version tag
  await $`devcontainer features publish ${featurePath} --registry ${registry} --namespace ${namespace}`;

  console.log(`✅ Successfully published ${feature}:${version}`);
  console.log(`   📖 Usage: "${registry}/${namespace}/${feature}:${version}"`);

  console.log('\n🎉 All features published successfully!');
  console.log(
    `\n🔗 Registry: https://github.com/ghostmind-dev/init/pkgs/container/features`
  );
}
