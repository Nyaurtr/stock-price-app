import React from 'react';

export interface ApiFormFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

const ApiFormField: React.FC<ApiFormFieldProps> = ({ 
  label, 
  type = 'text', 
  value, 
  onChange, 
  options,
  required = false,
  placeholder = ''
}) => {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <div className="mb-4 animate-fade-in">
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-error">*</span>}
      </label>
      
      {options ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-input"
          required={required}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-input"
          required={required}
          placeholder={placeholder}
        />
      )}
    </div>
  );
};

export default ApiFormField; 