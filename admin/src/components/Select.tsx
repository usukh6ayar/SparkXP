import { type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select
        {...props}
        className={cn(
          'rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm bg-white',
          'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          className,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
