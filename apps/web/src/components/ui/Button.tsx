
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
};

export function Button({
                         variant = 'primary',
                         className = '',
                         children,
                         type = 'button',
                         ...props
                       }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-button ui-button--${variant} ${className}`}
    >
      {children}
    </button>
  );
}
