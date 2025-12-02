/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Handle node modules that aren't available in browser
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false,
      crypto: false,
    };
    
    // Ignore react-native modules
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    
    // Externalize problematic modules
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    return config;
  },
  // Suppress specific warnings
  typescript: {
    // Dangerously allow production builds to complete even with type errors
    ignoreBuildErrors: false,
  },
  eslint: {
    // Don't fail build on eslint warnings
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
