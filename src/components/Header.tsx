import React from 'react';
import mainlogo from '../assets/mainlogo.png';

interface HeaderProps {
  onGenerate: () => void;
  isGenerateMode: boolean;
  onResetUI: () => void;
  onSaveCanvas?: () => void;
  onOpenTutorial?: () => void;
  onGoHome: () => void;
}

const Header: React.FC<HeaderProps> = ({ onGenerate, isGenerateMode, onResetUI, onSaveCanvas, onOpenTutorial, onGoHome }) => {
  return (
    <header className="header" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div 
        className="header-left" 
        onClick={onGoHome}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
      >
        <img 
          src={mainlogo} 
          alt='logo' 
          width="36"
          height="36"
          style={{ borderRadius: '8px', display: 'block' }} 
        />
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', margin: 0, fontFamily: "'Inter', 'Pretendard', sans-serif" }}>
          InfraGen
        </h1>
        
        {!isGenerateMode && (
          <span 
            onClick={(e) => { e.stopPropagation(); onOpenTutorial?.(); }}
            style={{ color: '#a0aec0', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '16px', marginLeft: '4px' }}
            title="튜토리얼 다시 보기"
          >
            ⓘ
          </span>
        )}
      </div>
      
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {!isGenerateMode && (
          <>
            <button className="generate-btn" onClick={onGenerate}>Generate</button>
            <span 
              className="header-icon" 
              onClick={onResetUI} 
              title="화면 뷰 초기화" 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
            </span>
            <span 
              className="header-icon" 
              onClick={onSaveCanvas} 
              title="현재 캔버스 저장" 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
            </span>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;