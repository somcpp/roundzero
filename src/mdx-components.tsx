import type { MDXComponents } from "mdx/types";
import { docsMdxComponents } from "@/components/docs/mdx";

// Required by @next/mdx: the components every .mdx file renders with.
export function useMDXComponents(): MDXComponents {
  return docsMdxComponents;
}
