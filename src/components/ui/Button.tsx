import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', children, ...props }) => {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-brand-blue text-white hover:bg-blue-700 focus:ring-brand-blue",
    secondary: "bg-brand-green text-white hover:bg-green-600 focus:ring-brand-green",
    outline: "border-2 border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white focus:ring-brand-blue"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
