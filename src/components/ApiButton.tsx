import React from 'react';

export interface ApiButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  isDisabled?: boolean; // Alias for disabled
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
}

const ApiButton: React.FC<ApiButtonProps> = ({ 
  onClick, 
  isLoading = false, 
  disabled = false,
  isDisabled = false,
  children,
  variant = 'primary'
}) => {
  const variantClass = variant === 'primary' 
    ? 'btn-primary' 
    : variant === 'secondary' 
      ? 'btn-secondary' 
      : 'btn-outline';
  
  const isButtonDisabled = isLoading || disabled || isDisabled;
  const disabledClass = isButtonDisabled ? "opacity-50 cursor-not-allowed" : "";
  
  return (
    <button
      type="button"
      className={`btn ${variantClass} ${disabledClass} inline-flex items-center animate-fade-in`}
      onClick={onClick}
      disabled={isButtonDisabled}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export default ApiButton; 