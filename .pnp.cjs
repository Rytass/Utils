#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
"use strict";

/**
 * Dummy PnP manifest to prevent esbuild from picking up ~/.pnp.cjs.
 * This project uses nodeLinker: node-modules (see .yarnrc.yml),
 * but esbuild's built-in PnP resolver walks up the directory tree
 * and finds the home directory's .pnp.cjs, which blocks resolution.
 * This file shadows it with an empty, permissive manifest.
 */
const RAW_RUNTIME_STATE =
'{\
  "__info": [\
    "Dummy PnP manifest — see comment above"\
  ],\
  "dependencyTreeRoots": [],\
  "enableTopLevelFallback": true,\
  "ignorePatternData": "",\
  "fallbackExclusionList": [],\
  "fallbackPool": [],\
  "packageRegistryData": []\
}';

function $$SETUP_STATE(hydrateRuntimeState, basePath) {
  return hydrateRuntimeState(JSON.parse(RAW_RUNTIME_STATE), {basePath: basePath || __dirname});
}

module.exports = {$$SETUP_STATE};
