'use client';

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react';

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          'inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white shadow-sm shadow-sky-500/20',
          'transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          'h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg',
          'placeholder:text-muted focus:border-sky-400/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20',
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
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-400" role="alert">
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
        'rounded-2xl border border-line bg-surface p-5 text-fg',
        className,
      )}
    >
      {children}
    </div>
  );
}
