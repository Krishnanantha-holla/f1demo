import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Visual heading shown in the card chrome. */
  title?: ReactNode;
  /** Right-aligned action area in the chrome. */
  action?: ReactNode;
  /** Footer rendered with subdued styling. */
  footer?: ReactNode;
  children: ReactNode;
}

export function CarbonCard({ title, action, footer, className = '', children, ...rest }: Props) {
  return (
    <div className={`carbon-card rounded-lg flex flex-col ${className}`} {...rest}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          {typeof title === 'string' ? (
            <span className="font-mono text-xs font-bold tracking-wider uppercase text-on-surface-variant">
              {title}
            </span>
          ) : (
            title
          )}
          {action}
        </div>
      )}
      <div className="flex-1 p-5">{children}</div>
      {footer && <div className="border-t border-white/5 px-5 py-2 text-[10px] font-mono text-on-surface-variant">{footer}</div>}
    </div>
  );
}
