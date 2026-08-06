'use client';

import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
} from 'react';
import { Spinner } from '@/components/ui/spinner';

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Mostra spinner e desabilita o botão durante uma ação assíncrona. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, loading, disabled, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cx(
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-label font-semibold text-white shadow-[0_8px_22px_rgb(4_66_191_/_0.18)]',
          'transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:bg-primary-hover hover:shadow-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          'min-h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body-sm text-fg shadow-xs',
          'placeholder:text-hint focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  // Liga o erro ao campo para leitores de tela (aria-describedby/aria-invalid).
  const field =
    error && isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-invalid': true,
          'aria-describedby': errorId,
        })
      : children;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg-soft">
        {label}
      </label>
      {field}
      {error ? (
        <p id={errorId} className="text-xs text-status-alert-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-surface p-5 text-fg shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
