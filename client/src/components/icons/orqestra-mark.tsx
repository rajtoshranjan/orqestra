import * as React from 'react';

import { LucideProps } from 'lucide-react';

type OrqestraMarkVariant = 'color' | 'mono' | 'light';

type OrqestraMarkProps = LucideProps & {
  variant?: OrqestraMarkVariant;
};

const VARIANT_FILLS: Record<
  OrqestraMarkVariant,
  { primary: string; accent: string }
> = {
  color: { primary: '#7156FB', accent: '#9C86FF' },
  mono: { primary: 'currentColor', accent: 'currentColor' },
  light: { primary: '#FFFFFF', accent: 'rgba(255,255,255,0.7)' },
};

export const OrqestraMark = React.forwardRef<SVGSVGElement, OrqestraMarkProps>(
  ({ size = 24, className, variant = 'color', ...props }, ref) => {
    const fills = VARIANT_FILLS[variant];

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="12 12 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Orqestra"
        className={className}
        {...props}
      >
        <rect x="14" y="14" width="18" height="18" rx="4.5" fill={fills.primary} />
        <rect x="40" y="14" width="18" height="18" rx="4.5" fill={fills.primary} />
        <rect x="66" y="14" width="18" height="18" rx="4.5" fill={fills.primary} />
        <rect x="14" y="40" width="18" height="18" rx="4.5" fill={fills.primary} />
        <rect x="66" y="40" width="18" height="18" rx="4.5" fill={fills.accent} />
        <rect x="14" y="66" width="18" height="18" rx="4.5" fill={fills.primary} />
        <rect x="40" y="66" width="18" height="18" rx="4.5" fill={fills.primary} />
        <rect x="66" y="66" width="18" height="18" rx="4.5" fill={fills.primary} />
        <rect x="88" y="88" width="18" height="18" rx="4.5" fill={fills.primary} />
      </svg>
    );
  },
);

OrqestraMark.displayName = 'OrqestraMark';
