import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  dark?: boolean;
}

export function GlassCard({ children, className, dark = false, ...props }: GlassCardProps) {
  return (
    <div
      className={`${dark ? 'glass-modal-dark' : 'glass-panel'} ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}
