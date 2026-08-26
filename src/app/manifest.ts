import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} – Arabisch lernen online`,
    short_name: brand.name,
    description: "Strukturierter Arabischkurs A1–C2 mit Live-Lehrkräften.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBFAF9",
    theme_color: "#4338CA",
  };
}
