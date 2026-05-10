/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — must run server-side only
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
