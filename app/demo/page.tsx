import type { Metadata } from "next";
import DemoClient from "./DemoClient";

export const metadata: Metadata = {
  title: "Démo Stratyx — Dupont Plomberie",
  description: "Simulation de gestion Google Ads pour artisan local",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoClient />;
}