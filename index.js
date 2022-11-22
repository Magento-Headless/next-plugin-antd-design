const { overrideWebpackConfig } = require('./overrideWebpackConfig');

// fix: prevents error when .less files are required by node
if (require && require.extensions) {
  require.extensions['.less'] = () => {};
}

module.exports =
  ({
    modifyVars = undefined,
    lessVarsFilePath = undefined,
    lessVarsFilePathAppendToEndOfContent = undefined,
    cssLoaderOptions = {
      esModule: false,
      sourceMap: false,
      modules: {
        mode: 'local'
      }
    },
    lessLoaderOptions = undefined
  } = {}) =>
  (nextConfig = {}) => {
    return Object.assign({}, nextConfig, {
      webpack(config, options) {
        const pluginOptions = {
          ...options,
          modifyVars,
          lessVarsFilePath,
          lessVarsFilePathAppendToEndOfContent,
          cssLoaderOptions,
          lessLoaderOptions
        }

        return overrideWebpackConfig({
          config,
          nextConfig,
          pluginOptions
        })
      }
    })
  }
