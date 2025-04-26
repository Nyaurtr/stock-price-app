import React from 'react';

interface TabPanelProps {
  children: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      className="focus:outline-none" 
    >
      {value === index && (
        <div className="py-6">
          {children}
        </div>
      )}
    </div>
  );
};

export default TabPanel; 