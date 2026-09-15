import React from 'react';

export const Card: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
};
