import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp', 'bcryptjs'],
  images: {
    remotePatterns: [],
  },
}

export default nextConfig
