"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  finalizeSlugInput,
  sanitizeSlugInput,
  SLUG_INPUT_PROPS,
  MAX_STORE_SLUG_LEN,
} from "@/lib/slug-utils";

export type SlugTextInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type"
> & {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
};

/** Native text input for URL slugs — avoids component layers that can swallow dash keystrokes. */
export function SlugTextInput({
  value,
  onChange,
  maxLength = MAX_STORE_SLUG_LEN,
  className,
  onKeyDown,
  onBlur,
  ...props
}: SlugTextInputProps) {
  function insertAsciiDash(input: HTMLInputElement) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = input.value.slice(0, start) + "-" + input.value.slice(end);
    onChange(sanitizeSlugInput(next, maxLength));
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(sanitizeSlugInput(e.target.value, maxLength))}
      onBeforeInput={(e) => {
        const native = e.nativeEvent as InputEvent;
        const data = native.data;
        const isDashLike =
          data === "-" ||
          data === "—" ||
          data === "–" ||
          data === "−" ||
          data === "‐" ||
          data === "‑";
        if (!isDashLike) return;
        // WebKit/macOS can emit non-ASCII dash chars via smart punctuation.
        e.preventDefault();
        insertAsciiDash(e.currentTarget);
      }}
      onKeyDown={(e) => {
        const key = e.key;
        const isComposing = (e.nativeEvent as globalThis.KeyboardEvent).isComposing;
        const isDashKey =
          key === "-" ||
          key === "—" ||
          key === "–" ||
          key === "−" ||
          e.code === "Minus" ||
          e.code === "NumpadSubtract";
        if (!isDashKey || isComposing || e.ctrlKey || e.metaKey || e.altKey) {
          onKeyDown?.(e);
          return;
        }

        // Some keyboard/layout combos emit dash-like characters that never
        // land in the input; force-insert ASCII '-' at the caret.
        e.preventDefault();
        insertAsciiDash(e.currentTarget);
        onKeyDown?.(e);
      }}
      onBlur={(e) => {
        onChange(finalizeSlugInput(e.currentTarget.value, maxLength));
        onBlur?.(e);
      }}
      maxLength={maxLength}
      inputMode="url"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30",
        className,
      )}
      {...SLUG_INPUT_PROPS}
      {...props}
    />
  );
}
