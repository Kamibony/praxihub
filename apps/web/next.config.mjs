/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prikáže Next.js vygenerovať statické HTML/CSS/JS do priečinka 'out'
  output: 'export', 
  
  // Firebase Hosting nepodporuje Next.js Image Optimization (vyžaduje server),
  // preto musíme vypnúť optimalizáciu obrázkov, inak build zlyhá alebo sa obrázky nezobrazia.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
