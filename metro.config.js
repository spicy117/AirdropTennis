// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude supabase functions directory from Metro bundler
if (!config.resolver) {
  config.resolver = {};
}
if (!config.resolver.blockList) {
  config.resolver.blockList = [];
}
config.resolver.blockList.push(/supabase\/functions\/.*/);

module.exports = config;
