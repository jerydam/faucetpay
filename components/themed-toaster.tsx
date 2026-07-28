"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      position="top-center"
      closeButton
      theme={resolvedTheme as "light" | "dark" | "system"}
    />
  );
}