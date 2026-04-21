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
        <rect x="10" y="5" width="80" height="90" rx="12" fill="#F47920" />
        
        {/* Folded corner */}
        <path d="M70 5L90 25H82C75.3726 25 70 19.6274 70 13V5Z" fill="#B45309" opacity="0.8" />
        
        {/* Eyes */}
        <circle cx="35" cy="45" r="7" fill="white" />
        <circle cx="65" cy="45" r="7" fill="white" />
        
        {/* Smile */}
        <path d="M30 65C30 65 40 78 50 78C60 78 70 65 70 65" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
        
        {/* Bottom line with dots */}
        <line x1="15" y1="88" x2="85" y2="88" stroke="#FFEDD5" strokeWidth="3" strokeLinecap="round" />
        <circle cx="15" cy="88" r="4" fill="#FFEDD5" />
        <circle cx="85" cy="88" r="4" fill="#FFEDD5" />
      </svg>
    </div>
  );
};

export default SmileyIcon;
