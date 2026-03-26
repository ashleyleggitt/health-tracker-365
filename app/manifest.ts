import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health Tracker 365",
    short_name: "Health365",
    description: "Personal wellness and habit tracking",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf8",
    theme_color: "#fffdf8",
    icons: [
      {
        src: "/icon.png",
        sizes: "1024x1024",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  };
}