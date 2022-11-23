const clone = require('clone');
const fs = require('fs');
const path = require('path');

const {
  getCssModuleLocalIdentForNextJs,
  loaderUtils,
} = require('./getCssModuleLocalIdent');

// fix: prevents error when .less files are required by node
if (require && require.extensions) {
  require.extensions['.less'] = () => {};
}

const isWebpack5 = (nextConfig) => {
  return (
    typeof nextConfig.webpack.version === 'string' &&
    nextConfig.webpack.version.startsWith('5')
  );
}

const handleAntdInServer = (webpackConfig, nextConfig) => {
  if (!nextConfig.isServer) return webpackConfig;

  const ANTD_STYLE_REGX = /(antd\/.*?\/style|@ant-design).*(?<![.]js)$/;
  const exts = [...webpackConfig.externals];

  webpackConfig.externals = isWebpack5(nextConfig)
    ? [
        // ctx and cb are both webpack5's params
        // ctx eqauls { context, request, contextInfo, getResolve }
        // https://webpack.js.org/configuration/externals/#function
        (ctx, cb) => {
          if (ctx.request.match(ANTD_STYLE_REGX)) return cb();

          // next's params are different when webpack5 enable
          // https://github.com/vercel/next.js/blob/0425763ed6a90f4ff99ab2ff37821da61d895e09/packages/next/build/webpack-config.ts#L770
          if (typeof exts[0] === 'function') return exts[0](ctx, cb);
          else return cb();
        },
        ...(typeof exts[0] === 'function' ? [] : exts),
      ]
    : [
        // webpack4
        (ctx, req, cb) => {
          if (req.match(ANTD_STYLE_REGX)) return cb();

          if (typeof exts[0] === 'function') return exts[0](ctx, req, cb);
          else return cb();
        },
        ...(typeof exts[0] === 'function' ? [] : exts),
      ];

  webpackConfig.module.rules.unshift({
    test: ANTD_STYLE_REGX,
    use: 'null-loader',
  });

  return webpackConfig;
}

const overrideWebpackConfig = ({ webpackConfig, nextConfig, pluginOptions }) => {
  if (!nextConfig.defaultLoaders) {
    throw new Error(
      'This plugin is not compatible with Next.js versions below 5.0.0 https://err.sh/next-plugins/upgrade',
    );
  }

  let __DEV__ = nextConfig.dev;

  const { rules } = webpackConfig.module;

  // compatible w/ webpack 4 and 5
  const ruleIndex = rules.findIndex((rule) => Array.isArray(rule.oneOf));
  const rule = rules[ruleIndex];

  // default localIdentName
  let localIdentName = __DEV__ ? '[local]--[hash:base64:4]' : '[hash:base64:8]';

  if (
    pluginOptions &&
    pluginOptions.cssLoaderOptions &&
    pluginOptions.cssLoaderOptions.modules &&
    pluginOptions.cssLoaderOptions.modules.localIdentName
  ) {
    localIdentName = pluginOptions.cssLoaderOptions.modules.localIdentName;
  }

  let localIdentNameFollowDev = false;

  if (
    pluginOptions &&
    pluginOptions.nextjs &&
    pluginOptions.nextjs.localIdentNameFollowDev
  ) {
    localIdentNameFollowDev = pluginOptions.nextjs.localIdentNameFollowDev;
  }

  /*
  |--------------------------------------------------------------------------
  | cssModule
  |--------------------------------------------------------------------------
  |
  | delete default `getLocalIdent` and set `localIdentName`
  |
  */
  const cssModuleRegx = '/\\.module\\.css$/';
  const cssModuleIndex = rule.oneOf.findIndex(
    (item) => `${item.test}` === cssModuleRegx,
  );
  const cssModule = rule.oneOf[cssModuleIndex];
  const cssLoaderInCssModule = cssModule.use.find((item) =>
    `${item.loader}`.includes('css-loader'),
  );

  if (pluginOptions.cssLoaderOptions) {
    cssLoaderInCssModule.options = {
      ...cssLoaderInCssModule.options,
      ...pluginOptions.cssLoaderOptions,
    };
  }

  if (
    pluginOptions.cssLoaderOptions &&
    pluginOptions.cssLoaderOptions.modules
  ) {
    cssLoaderInCssModule.options.modules = {
      ...cssLoaderInCssModule.options.modules,
      ...pluginOptions.cssLoaderOptions.modules,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | lessLoader (from the sassLoader clone)
  |--------------------------------------------------------------------------
  | Tips:
  | sass has  test `module` and `non-module` loader,
  | but `less-loader` has `auto: true`, so just copy onec.
  */
  const sassLoaderIndex = rule.oneOf.findIndex(
    (item) => item.test.toString() === /\.module\.(scss|sass)$/.toString(),
  );
  const sassLoader = rule.oneOf[sassLoaderIndex];

  // clone
  const lessLoader = clone(sassLoader);
  lessLoader.test = /\.less$/;
  delete lessLoader.issuer;

  // overwrite
  const lessLoaderIndex = lessLoader.use.findIndex((item) =>
    `${item.loader}`.includes('sass-loader'),
  );

  // merge lessLoader options
  const lessLoaderOptions = {
    lessOptions: {
      javascriptEnabled: true,
    },
    ...pluginOptions.lessLoaderOptions,
  };

  /*
  |--------------------------------------------------------------------------
  | file-loader supported *.less
  |--------------------------------------------------------------------------
  | url()s fail to load files
  | https://github.com/SolidZORO/next-plugin-antd-less/issues/39
  */
  const fileLoaderIndex = rule.oneOf.findIndex((item) => {
    if (
      item.use &&
      item.use.loader &&
      item.use.loader.includes('/file-loader/')
    ) {
      return item;
    }
  });

  const fileLoader = rule.oneOf[fileLoaderIndex];

  if (fileLoader) {
    // RAW ---> issuer: /\.(css|scss|sass)$/,
    fileLoader.issuer = /\.(css|scss|sass|less)$/;
  }

  /*
  |--------------------------------------------------------------------------
  | noop-loader supported *.less (Next.js ONLY)
  |--------------------------------------------------------------------------
  */
  const noopLoaderIndex = rule.oneOf.findIndex((item) => {
    if (
      item &&
      item.test &&
      item.test.toString() ===
        // RAW test
        /\.(css|scss|sass)(\.webpack\[javascript\/auto\])?$/.toString()
    ) {
      return item;
    }
  });

  const noopLoader = rule.oneOf[noopLoaderIndex];

  if (noopLoader) {
    noopLoader.test =
      /\.(css|scss|sass|less)(\.webpack\[javascript\/auto\])?$/;
  }

  const ignoreLoaderIndex = rule.oneOf.findIndex(
    (item) =>
      item &&
      item.use &&
      item.use.includes &&
      item.use.includes('ignore-loader'),
  );

  const ignoreLoader = rule.oneOf[ignoreLoaderIndex];

  if (ignoreLoader) {
    // RAW ---> test: [ /(?<!\.module)\.css$/, /(?<!\.module)\.(scss|sass)$/ ],
    ignoreLoader.test = [
      /(?<!\.module)\.css$/,
      /(?<!\.module)\.(scss|sass|less)$/,
    ];
  }

  /*
  |--------------------------------------------------------------------------
  | modifyVars (Hot Reload is **NOT Supported**, NEED restart webpack)
  |--------------------------------------------------------------------------
  |
  | CONSTANTS --> e.g. `@THEME--DARK: 'theme-dark';`
  |                    `:global(.@{THEME--DARK}) { color: red }`
  */
  let modifyVars = undefined;

  if (pluginOptions.modifyVars) {
    modifyVars = pluginOptions.modifyVars;
  }

  if (pluginOptions.modifyVars) {
    lessLoaderOptions.lessOptions.modifyVars = modifyVars;
  }

  /*
  |--------------------------------------------------------------------------
  | lessVarsFilePath (Hot Reload is **Supported**, can overwrite `antd` vars)
  |--------------------------------------------------------------------------
  | variables file --> e.g. `./styles/variables.less`
  |                         `@primary-color: #04f;`
  */
  if (pluginOptions.lessVarsFilePath) {
    lessLoaderOptions.additionalData = (content) => {
      const lessVarsFileResolvePath = path.resolve(
        pluginOptions.lessVarsFilePath,
      );

      if (fs.existsSync(lessVarsFileResolvePath)) {
        const importLessLine = `@import '${lessVarsFileResolvePath}';`;

        // https://github.com/SolidZORO/next-plugin-antd-less/issues/40
        if (pluginOptions.lessVarsFilePathAppendToEndOfContent) {
          content = `${content}\n\n${importLessLine};`;
        } else {
          content = `${importLessLine};\n\n${content}`;
        }

        // console.log(content);
      }

      return content;
    };
  }

  lessLoader.use.splice(lessLoaderIndex, 1, {
    loader: 'less-loader',
    options: lessLoaderOptions
  });

  // find
  const cssLoaderInLessLoaderIndex = lessLoader.use.findIndex((item) =>
    `${item.loader}`.includes('css-loader')
  );
  const cssLoaderInLessLoader = lessLoader.use.find((item) =>
    `${item.loader}`.includes('css-loader')
  );

  // in CRA v5.0, `sass-loader` uses `resolve-url-loader` by default,
  // but `less-loader` doesn't need it and will throw an ERROR if it does
  const resolveUrlLoaderInLessLoaderIndex = lessLoader.use.findIndex((item) =>
    `${item.loader}`.includes('resolve-url-loader'),
  );

  lessLoader.use.splice(resolveUrlLoaderInLessLoaderIndex, 1);

  // clone
  const cssLoaderClone = clone(cssLoaderInLessLoader);

  let getLocalIdentFn = (context, _, exportName, options) =>
    getCssModuleLocalIdentForNextJs(
      context,
      _,
      exportName,
      options,
      __DEV__,
      localIdentNameFollowDev,
    );

  if (
    pluginOptions &&
    pluginOptions.cssLoaderOptions &&
    pluginOptions.cssLoaderOptions.modules &&
    pluginOptions.cssLoaderOptions.modules.getLocalIdent
  ) {
    getLocalIdentFn = pluginOptions.cssLoaderOptions.modules.getLocalIdent;
  }

  // merge CssModule options
  cssLoaderClone.options = {
    ...cssLoaderClone.options,
    sourceMap: Boolean(__DEV__),
    ...pluginOptions.cssLoaderOptions,
    //
    modules: {
      localIdentName,
      ...cssLoaderClone.options.modules,
      mode: 'local', // local, global, and pure, next.js default is `pure`
      //
      // Inherited from pluginOptions
      ...(pluginOptions.cssLoaderOptions || {}).modules,
      //
      // recommended to keep `true`!
      auto: true,
      // Next.js need getLocalIdent (non-full-featured localIdentName 😂)
      // CRA Don't need it (full-featured localIdentName)
      getLocalIdent: getLocalIdentFn
    }
  };

  // overwrite
  lessLoader.use.splice(cssLoaderInLessLoaderIndex, 1, cssLoaderClone);

  // ---- append lessLoader to webpack modules ----
  rule.oneOf.splice(sassLoaderIndex, 0, lessLoader);
  webpackConfig.module.rules[ruleIndex] = rule;

  // ---- handleAntdInServer (ONLY Next.js) ----
  webpackConfig = handleAntdInServer(webpackConfig, nextConfig);

  if (typeof pluginOptions.webpack === 'function') {
    return pluginOptions.webpack(webpackConfig, nextConfig);
  }

  return webpackConfig;
}

module.exports = {
  overrideWebpackConfig,
  handleAntdInServer,
  loaderUtils,
  getCssModuleLocalIdentForNextJs
};
