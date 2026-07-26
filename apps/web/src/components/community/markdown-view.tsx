'use client';

import { renderMarkdownToHtml } from '@hubpatients/core';

/** Renderiza markdown básico já sanitizado (ver utils/markdown). */
export function MarkdownView({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div
      className={`text-sm leading-relaxed text-fg [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_em]:italic [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 ${className}`}
      // Seguro: renderMarkdownToHtml escapa a entrada antes de aplicar markdown.
      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
    />
  );
}
