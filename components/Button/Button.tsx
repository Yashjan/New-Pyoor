import Link from 'next/link';
import type { ComponentProps } from 'react';
import styles from './Button.module.css';

/**
 * Pyoor buttons (design-system/component-Button.md).
 *
 * primary   button-bg / button-ink: navy on ivory, gold on navy. One per screen.
 * secondary transparent with a hairline-strong outline.
 * link      Manrope 500 text with a 1px gold underline that withdraws on hover.
 *
 * A disabled button (e.g. "Price coming soon") renders in surface-sunk / text-muted.
 * Use <ButtonLink> for navigation and <Button> for actions.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'link';

interface StyleProps {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

function classes({ variant = 'primary', fullWidth }: StyleProps, extra?: string) {
  return [
    variant === 'link' ? styles.link : styles.btn,
    variant !== 'link' && styles[variant],
    fullWidth && styles.fullWidth,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  fullWidth,
  className,
  type = 'button',
  ...rest
}: StyleProps & ComponentProps<'button'>) {
  return <button type={type} className={classes({ variant, fullWidth }, className)} {...rest} />;
}

export function ButtonLink({
  variant,
  fullWidth,
  className,
  ...rest
}: StyleProps & ComponentProps<typeof Link>) {
  return <Link className={classes({ variant, fullWidth }, className)} {...rest} />;
}
