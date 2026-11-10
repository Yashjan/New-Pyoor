import { Fragment } from 'react';

/**
 * Devanagari text in Tiro Devanagari Hindi.
 *
 * Each word gets its own span and the spaces between words stay in the surrounding font.
 * A space inside a Tiro span would make the browser download Tiro's *latin* subset
 * (~20 KB) just for that one glyph.
 */
export function HindiText({ children, className }: { children: string; className?: string }) {
  const words = children.split(/\s+/).filter(Boolean);
  return (
    <span lang="hi" className={className}>
      {words.map((word, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="hindi">{word}</span>
        </Fragment>
      ))}
    </span>
  );
}
