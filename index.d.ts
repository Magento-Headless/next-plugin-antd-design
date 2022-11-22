import type { NextConfig } from 'next'

declare const NextPluginAntdDesign =
  (options?: {
    modifyVars?: any;
    lessVarsFilePath?: any
    lessVarsFilePathAppendToEndOfContent?: any
    cssLoaderOptions?: any
    lessLoaderOptions?: any
  }) =>
  (config?: NextConfig) =>
    NextConfig

export = NextPluginAntdDesign
