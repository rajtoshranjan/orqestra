import * as React from 'react';
import { LucideProps } from 'lucide-react';

export const CommentMarker = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ color = 'currentColor', size = 24, className, ...props }, ref) => {
    const filterId = React.useId();

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        className={className}
        {...props}
      >
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.5"
              floodOpacity="0.4"
              floodColor="black"
            />
          </filter>
        </defs>

        <path
          d="M 5.5 30.5 L 5.5 18 A 12.5 12.5 0 0 1 18 5.5 A 12.5 12.5 0 0 1 30.5 18 A 12.5 12.5 0 0 1 18 30.5 L 5.5 30.5 Z"
          fill={color}
          stroke="white"
          strokeWidth="2"
          filter={`url(#${filterId})`}
        />
      </svg>
    );
  },
);

CommentMarker.displayName = 'CommentMarker';
