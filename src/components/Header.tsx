import React from 'react';
import mainlogo from '../assets/mainlogo.png';

interface HeaderProps {
  onGenerate: () => void;
  isGenerateMode: boolean;
  onResetUI: () => void;
  onSaveCanvas?: () => void;
  onOpenTutorial?: () => void;
  onGoHome: () => void;
  // 프로젝트를 새로 만든 직후, 도움말 버튼 위치를 알려주는 말풍선 표시 여부
  showTutorialHint?: boolean;
  onDismissTutorialHint?: () => void;
}

const HINT_STYLES = `
  @keyframes tutorialHintPulse {
    0%   { box-shadow: 0 0 0 0 rgba(95, 207, 173, 0.6); }
    70%  { box-shadow: 0 0 0 10px rgba(95, 207, 173, 0); }
    100% { box-shadow: 0 0 0 0 rgba(95, 207, 173, 0); }
  }
  @keyframes tutorialHintIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .tutorial-hint-target {
    border-radius: 14px;
    animation: tutorialHintPulse 1.6s ease-out infinite;
  }
  .tutorial-hint-bubble {
    position: absolute;
    top: calc(100% + 12px);
    left: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    background: #2d3748;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    white-space: nowrap;
    border-radius: 10px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
    cursor: pointer;
    animation: tutorialHintIn 0.25s ease-out;
  }
  .tutorial-hint-bubble::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 18px;
    width: 12px;
    height: 12px;
    background: #2d3748;
    transform: rotate(45deg);
  }
  .tutorial-hint-close {
    background: transparent;
    border: none;
    color: #a0aec0;
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    cursor: pointer;
  }
  .tutorial-hint-close:hover { color: #fff; }
`;

const Header: React.FC<HeaderProps> = ({
  onGenerate, isGenerateMode, onResetUI, onSaveCanvas, onOpenTutorial, onGoHome,
  showTutorialHint = false, onDismissTutorialHint
}) => {
  return (
    <header className="header" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <style>{HINT_STYLES}</style>
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
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
            <span
              className={showTutorialHint ? 'tutorial-hint-target' : undefined}
              onClick={(e) => { e.stopPropagation(); onOpenTutorial?.(); }}
              style={{ color: showTutorialHint ? '#28b4ad' : '#a0aec0', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '16px', padding: '2px 8px' }}
              title="튜토리얼 다시 보기"
            >
              <span>ⓘ</span>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>도움말</span>
            </span>

            {showTutorialHint && (
              <div
                className="tutorial-hint-bubble"
                onClick={(e) => { e.stopPropagation(); onOpenTutorial?.(); }}
              >
                <span>처음이신가요? 도움말을 눌러 튜토리얼을 시작해보세요</span>
                <button
                  type="button"
                  className="tutorial-hint-close"
                  aria-label="안내 닫기"
                  onClick={(e) => { e.stopPropagation(); onDismissTutorialHint?.(); }}
                >
                  ✕
                </button>
              </div>
            )}
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