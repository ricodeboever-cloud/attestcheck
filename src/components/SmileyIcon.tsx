import React from 'react';

interface SmileyIconProps {
  size?: number;
  style?: React.CSSProperties;
}

const SmileyIcon: React.FC<SmileyIconProps> = ({ size = 64, style }) => {
  return (
    <div style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Main body */}
        <rect x="10" y="10" width="80" height="80" rx="12" fill="#F47920" />
        
        {/* Radar circles */}
        <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="4" strokeOpacity="0.4" fill="none" />
        <circle cx="50" cy="50" r="15" stroke="white" strokeWidth="4" strokeOpacity="0.6" fill="none" />
        
        {/* Scanning line */}
        <line x1="50" y1="50" x2="80" y2="50" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8">
          <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="2s" repeatCount="indefinite" />
        </line>
        
        {/* Bottom line with dots */}
        <line x1="15" y1="88" x2="85" y2="88" stroke="#FFEDD5" strokeWidth="3" strokeLinecap="round" />
        <circle cx="15" cy="88" r="4" fill="#FFEDD5" />
        <circle cx="85" cy="88" r="4" fill="#FFEDD5" />
      </svg>
    </div>
  );
};

export default SmileyIcon;
