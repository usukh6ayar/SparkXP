import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../lib/utils';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={cn(
          'rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          error && 'border-red-400',
          className,
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';
