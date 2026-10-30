import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class names joined and de-conflicted, as the shadcn/AI Elements components expect. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
