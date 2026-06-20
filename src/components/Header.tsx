import React from 'react';
import mainlogo from '../assets/mainlogo.png';

interface HeaderProps {
  onGenerate: () => void;
  isGenerateMode: boolean;
  onResetUI: () => void;
}

const Header: React.FC<HeaderProps> = ({ onGenerate, isGenerateMode, onResetUI }) => {
  return (
    <header className="header">
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img 
          src={mainlogo} 
          alt='logo' 
          style={{ height: '40px', width: 'auto', objectFit: 'contain', display: 'block' }} 
        />
        <strong style={{ fontSize: '18px', color: '#2c3e50', lineHeight: 1 }}>infraGEN</strong>
        
        {!isGenerateMode && (
          <span style={{ color: '#ccc', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>ⓘ</span>
        )}
      </div>
      
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {!isGenerateMode && (
          <>
            <button className="generate-btn" onClick={onGenerate}>Generate</button>
            <span className="header-icon" onClick={onResetUI} title="화면 뷰 초기화" style={{ cursor: 'pointer', marginLeft: 0 }}>↺</span>
            <span className="header-icon" style={{ cursor: 'pointer', marginLeft: 0 }}>💾</span>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;