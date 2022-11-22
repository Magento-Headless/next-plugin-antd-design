# Next.js + Antd (with Less)

Use [Antd] (Less) w/ [Next.js], Zero Dependency on other Next-Plugins.


## Features

- Zero Dependency on other [Next.js] Plugins
- Support Hot-Update After modifying [Antd] less vars
- Support Serverless Mode
- Support Antd Pro

## Compatibility

- Next.js v11 / v12

## Installation

```sh
yarn add next-plugin-antd-less
yarn add --dev babel-plugin-import
```


## Usage

### for [Next.js]

```js
// next.config.js
const withAntdLess = require('next-plugin-antd-less');

module.exports = withAntdLess({
  modifyVars: { '@primary-color': '#04f' }, // optional
  lessVarsFilePath: './src/styles/variables.less', // optional 
  lessVarsFilePathAppendToEndOfContent: false, // optional
  // optional https://github.com/webpack-contrib/css-loader#object
  cssLoaderOptions: {
    // ... 
    mode: "local",
    localIdentName: __DEV__ ? "[local]--[hash:base64:4]" : "[hash:base64:8]", // invalid! for Unify getLocalIdent (Next.js / CRA), Cannot set it, but you can rewritten getLocalIdentFn
    exportLocalsConvention: "camelCase",
    exportOnlyLocals: false,
    // ...
    getLocalIdent: (context, localIdentName, localName, options) => {
      return "whatever_random_class_name";
    },
  },

  // for Next.js ONLY
  nextjs: {
    localIdentNameFollowDev: true, // default false, for easy to debug on PROD mode
  },

  // Other Config Here...

  webpack(config) {
    return config;
  },

  // ONLY for Next.js 10, if you use Next.js 11, delete this block
  future: {
    webpack5: true,
  },
});
```

Add a `.babelrc.js`

```js
// .babelrc.js
module.exports = {
  presets: [['next/babel']],
  plugins: [['import', { libraryName: 'antd', style: true }]],
};
```

Detailed config can be found in [`next.config.js`](https://github.com/SolidZORO/mkn/blob/master/next.config.js)
file.

### Default ClassName

| MODE      | className                  | e.g.                  |
| --------- |----------------------------|-----------------------|
| DEV       | `[local]--[hash:base64:4]` | `comp-wrapper--2Rra ` |
| PROD      | `[hash:base64:8]`          | `2Rra8Ryx`            |

for Unify getLocalIdent (Next.js / CRA), Cannot set it, but you can rewritten getLocalIdentFn


### localIdentName is invalid? How to rewritten?

you can defind your own `localIdentName` in `pluginOptions.cssLoaderOptions.modules.getLocalIdent`

```javascript
  options: {
  lessVarsFilePath: './src/styles/variables.less'
  // ...
  // https://github.com/webpack-contrib/css-loader/tree/b7a84414fb3f6e6ff413cbbb7004fa74a78da331#getlocalident
  //
  // and you can see file 
  getLocalIdent: (context, _, exportName, options) => {
    return 'whatever_random_class_name';
  }
  // ...
}
```

### How to import global `CSS` style (e.g. styles.css)?

```tsx
// ./page/_app.tsx
//
// use `import` or `require` syntax,
import './styles.css';
```

### How to import global `Less` style (e.g. styles.less)?

```tsx
// ./page/_app.tsx
//
// use `require` syntax,
require('./styles.less');
```

### How to overwrite `antd` less variables?

```less
// ./src/styles/variables.less
@import '~antd/lib/style/themes/default.less'; // <-- you need to import antd variables once in your project

@primary-color: #04f; // change antd primary-color
```


```js
// 🔰️ Tips: if your use babel import plugin and set `libraryDirectory`, please keep `libraryDirectory` and `less path` consistent.

// lib
['import', { libraryName: 'antd', libraryDirectory: 'lib', style: true }]
// `@import '~antd/lib/style/themes/default.less';` <-- use `lib`

// es
  ['import', { libraryName: 'antd', libraryDirectory: 'es', style: true }]
// --> `@import '~antd/es/style/themes/default.less';` <-- use `es`
```


```js
// plugin options
lessVarsFilePath: './src/styles/variables.less'
```

## Background

### Issues

Since Next.js 9.3 supports `sass` and `css` by default, but does not support `less`. If you use Next.js > `9.3` and use the official less plugin, you will definitely encounter the following problems.

1. CIL Warning `Warning: Built-in CSS support is being disabled due to custom CSS configuration being detected.`

2. Does not support automatic recognition of css modules, e.g. `a.module.less`
   and `a.less`

### Solution

1. Find sassModule and copy onec and replace the `sass-loader` inside with `less-loader`.

2. Then enable the `modules.auto` option of `css-loader`. This can simply match all `*.less` (no need to match it is `*.module.less` or `*.less`), and hand it over to `css-loader`.

This is the lowest cost way, And CLI will no longer show this disgusting warning. The important thing is that there is **Zero Dependency on other Next-Plugins.**.

<!-- links -->

[Next.js]: https://nextjs.org/

[Antd]: https://github.com/ant-design/ant-design/

[CRA]: https://create-react-app.dev/

[CRA-co]: https://github.com/gsoft-inc/craco
