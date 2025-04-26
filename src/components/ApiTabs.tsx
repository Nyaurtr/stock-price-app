import React from 'react';

interface ApiTabsProps {
  tabs: string[];
  currentTab: number;
  onChange: (index: number) => void;
}

const ApiTabs: React.FC<ApiTabsProps> = ({ tabs, currentTab, onChange }) => {
  return (
    <div className="border-b animate-fade-in">
      <nav className="-mb-px flex overflow-auto" aria-label="Tabs">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => onChange(index)}
            className={`
              whitespace-nowrap py-4 px-5 border-b-2 font-medium text-sm tab-underline 
              ${currentTab === index
                ? 'border-primary text-primary tab-active'
                : 'border-transparent hover:border-gray-300'}
            `}
            aria-current={currentTab === index ? 'page' : undefined}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default ApiTabs; 