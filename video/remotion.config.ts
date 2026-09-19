import { Config } from '@remotion/cli/config';

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    experiments: {
      ...currentConfiguration.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    },
  };
});
