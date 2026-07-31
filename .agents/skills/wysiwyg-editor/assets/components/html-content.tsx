"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

interface HtmlContentProps {
  html: string;
  className?: string;
  /** If true, inverts colors for dark backgrounds */
  invertColors?: boolean;
}

/**
 * Safely renders HTML content with proper styling for lists, links, and prose.
 * Uses DOMPurify for XSS protection.
 */
export function HtmlContent({ html, className, invertColors }: HtmlContentProps) {
  const sanitizedHtml = useMemo(() => {
    if (!html) return null;
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "b", "em", "i", "u", "s", "a",
        "ul", "ol", "li", "blockquote", "pre", "code", "span", "div",
        "h1", "h2", "h3", "h4", "h5", "h6"
      ],
      ALLOWED_ATTR: ["href", "target", "rel", "class"],
      ADD_ATTR: ["target"],
    });
  }, [html]);

  // Extract text content to check if there's actual visible content
  const hasContent = useMemo(() => {
    if (!sanitizedHtml) return false;
    return sanitizedHtml.replace(/<[^>]*>/g, "").trim() !== "";
  }, [sanitizedHtml]);

  if (!hasContent) {
    return (
      <span className={cn("italic opacity-70", className)}>
        No content
      </span>
    );
  }

  return (
    <div
      className={cn(
        "text-sm break-words",
        "prose prose-sm max-w-none",
        // Tight vertical spacing
        "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        // Link styling
        "prose-a:underline prose-a:underline-offset-2",
        // CRITICAL: List styling - without this, bullets/numbers won't show
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        // Dark mode or inverted colors
        invertColors
          ? "prose-invert prose-a:text-inherit/90"
          : "dark:prose-invert prose-a:text-primary",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

/**
 * Allowed tags configuration for DOMPurify - use this for consistent sanitization
 */
export const HTML_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "a",
    "ul", "ol", "li", "blockquote", "pre", "code", "span", "div",
    "h1", "h2", "h3", "h4", "h5", "h6"
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
  ADD_ATTR: ["target"],
} as const;

/**
 * Utility function to sanitize HTML without rendering
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, HTML_SANITIZE_CONFIG);
}

/**
 * Check if HTML content has actual visible text
 */
export function hasVisibleContent(html: string | null | undefined): boolean {
  if (!html) return false;
  const sanitized = DOMPurify.sanitize(html, HTML_SANITIZE_CONFIG);
  return sanitized.replace(/<[^>]*>/g, "").trim() !== "";
}
