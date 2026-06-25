import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format an ISO date string as a short Mongolian date (e.g. 2026.6.24). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('mn-MN');
}
