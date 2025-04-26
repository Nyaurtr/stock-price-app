import React from 'react';

interface GridItemProps {
  children: React.ReactNode;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
}

// Responsive grid item using Tailwind CSS
const GridItem: React.FC<GridItemProps> = ({ children, xs = 12, sm, md, lg }) => {
  // Convert MUI grid sizes to Tailwind percentages
  const getColumnClasses = () => {
    const classes = [];
    
    // Default (xs) - mobile first
    classes.push(`w-${xs === 12 ? 'full' : `${Math.round(100 * xs / 12)}%`}`);
    
    // sm breakpoint (640px+)
    if (sm) classes.push(`sm:w-${sm === 12 ? 'full' : `${Math.round(100 * sm / 12)}%`}`);
    
    // md breakpoint (768px+)
    if (md) classes.push(`md:w-${md === 12 ? 'full' : `${Math.round(100 * md / 12)}%`}`);
    
    // lg breakpoint (1024px+)
    if (lg) classes.push(`lg:w-${lg === 12 ? 'full' : `${Math.round(100 * lg / 12)}%`}`);
    
    return classes.join(' ');
  };
  
  return (
    <div className={`px-2 ${getColumnClasses()}`}>
      {children}
    </div>
  );
};

export default GridItem; 