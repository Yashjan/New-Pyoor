import type { ElementType } from 'react';

interface SplitTextProps {
  as?: ElementType;
  children: string;
  className?: string;
  id?: string;
}

/**
 * A heading split into word masks, so each word can rise into view (brand book §9:
 * "text reveals line by line"). Rendered on the server: the text is complete and visible
 * without JS; HomeMotion animates `.py-ln > span`. Screen readers get the plain sentence.
 */
export function SplitText({ as: Tag = 'h2', children, className, id }: SplitTextProps) {
  const words = children.trim().split(/\s+/);
  return (
    <Tag className={className} id={id} data-split>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i}>
            {i > 0 && ' '}
            <span className="py-ln">
              <span>{word}</span>
            </span>
          </span>
        ))}
      </span>
    </Tag>
  );
}
