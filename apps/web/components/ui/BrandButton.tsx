import React from 'react';

interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function BrandButton({ children, className, ...props }: BrandButtonProps) {
  return (
    <button
      className={`btn-primary ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
