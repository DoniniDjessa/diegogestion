/** @type {import('next').NextConfig} */
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  // HTTP-level redirects avoid next/navigation redirect() inside the
  // client AppShell, which crashes the App Router ("Rendered more hooks…").
  async redirects() {
    return [
      { source: "/", destination: "/caisse", permanent: false },
      { source: "/menu", destination: "/parametres/menu", permanent: false },
    ];
  },
};

export default nextConfig;
