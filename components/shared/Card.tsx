
import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerContent?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', headerContent }) => {
  return (
    <div className={`bg-gray-800 border border-gray-700 flex flex-col ${className}`}>
      <div className="bg-gray-900 px-3 py-1 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-300">{title}</h2>
        {headerContent}
      </div>
      {children}
    </div>
  );
};

export default Card;
