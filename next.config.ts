import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  // Uses Rust-based compiler for these heavy packages
  transpilePackages: ["@langchain/community", "@langchain/core", "mammoth"],
  
  experimental: {
    // 1. Enable the new React Compiler for better runtime
    // Improves runtime by reducing re-renders during heavy tasks (like uploads)
    reactCompiler: true,
    
    // 2. Tree-shaking for your AI and UI libraries
    optimizePackageImports: [
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "lucide-react",
      "date-fns",
      "langchain",
      "@langchain/community",
      "@langchain/core",
      "@huggingface/inference",
    ],
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
