

/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
           {
            source:"/project/:slug",
            destination:"https://deployify-project.s3.ap-south-1.amazonaws.com/__output/:slug/index.html"
           }
        ]
    },
};

export default nextConfig;
