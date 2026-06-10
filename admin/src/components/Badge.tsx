import { cn } from '../lib/utils';

interface Props {
  children: React.ReactNode;
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'gray';
}

const colors = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  gray: 'bg-gray-100 text-gray-700',
};

export function Badge({ children, color = 'gray' }: Props) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colors[color])}>
      {children}
    </span>
  );
}
