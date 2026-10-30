import { notFound } from "next/navigation";
import { Showcase } from "./showcase";

export const metadata = { title: "Components" };

// Dev-only reference of every HeroUI component, styled with the app's tokens.
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
