import Link from 'next/link';
import type { ComponentProps } from 'react';
import styles from './Button.module.css';

/**
 * primary: gold fill, navy text (on navy surfaces)
 * outline: gold hairline, ivory text (on navy surfaces)
 * dark:    navy fill, ivory text (on ivory surfaces; gold on ivory is only 1.75:1)
 */
export type ButtonVariant = 'primary' | 'outline' | 'dark';

interface StyleProps {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
}

function classes({ variant = 'primary', size = 'md', fullWidth }: StyleProps, extra?: string) {
  return [
    styles.button,
    styles[variant],
    size === 'sm' && styles.sm,
    fullWidth && styles.fullWidth,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = StyleProps & ComponentProps<'button'>;

export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={classes({ variant, size, fullWidth }, className)} {...rest} />
  );
}

type ButtonLinkProps = StyleProps & ComponentProps<typeof Link>;

export function ButtonLink({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={classes({ variant, size, fullWidth }, className)} {...rest} />;
}
