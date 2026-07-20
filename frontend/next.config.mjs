import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@contracts': path.resolve(__dirname, '../contracts'),
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser'),
    };

    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
  transpilePackages: [
    '@midnight-ntwrk/compact-js',
    '@midnight-ntwrk/compact-runtime',
    '@midnight-ntwrk/ledger-v8',
    '@midnight-ntwrk/midnight-js-contracts',
    '@midnight-ntwrk/midnight-js-fetch-zk-config-provider',
    '@midnight-ntwrk/midnight-js-network-id',
  ],
};

export default nextConfig;
