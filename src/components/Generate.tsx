import React from 'react';
import type { FileGroup } from '../types';

interface GenerateProps {
  genProgress: number;
  targetFileIds: string[];
  files: FileGroup[];
  projectName: string;
  onBack: () => void;
}

const Generate: React.FC<GenerateProps> = ({ genProgress, targetFileIds, files, projectName, onBack }) => {
<<<<<<< HEAD
=======
  
  // 용량 임의 지정
>>>>>>> e9d1a50109e7c50d519d53a0e37f636e3da4d0cf
  const totalNodes = targetFileIds.reduce((sum, fileId) => {
    const file = files.find(f => f.id === fileId);
    return sum + (file ? file.nodeIds.length : 0);
  }, 0);
  
  const estimatedSize = (totalNodes * 0.1).toFixed(1);

  return (
    <div className="gen-screen">
      <aside className="gen-sidebar">
        <div className="gen-card">
          <div className="gen-card-header">
            <span style={{ color: genProgress === 100 ? 'var(--mint)' : '#4a5568' }}>
              {genProgress === 100 ? '생성 완료' : '코드 생성중...'}
            </span>
            <span style={{ color: 'var(--mint)', fontWeight: 'bold' }}>{genProgress}%</span>
          </div>
          <div className="gen-progress-bar">
            <div className="gen-progress-fill" style={{ width: `${genProgress}%` }}></div>
          </div>
        </div>

        <div className="gen-card">
          <div className="gen-card-title">프로젝트명</div>
<<<<<<< HEAD
=======
          {/*전달받은 프로젝트명*/}
>>>>>>> e9d1a50109e7c50d519d53a0e37f636e3da4d0cf
          <div className="gen-card-value">{projectName}</div> 
        </div>

        <div className="gen-card">
          <div className="gen-card-title">파일 개수</div>
          <div className="gen-card-value">{genProgress === 100 ? `${targetFileIds.length}개` : '계산중...'}</div>
        </div>

        <div className="gen-card">
          <div className="gen-card-title">예상 용량</div>
<<<<<<< HEAD
=======
          {/* 계산된 예상 용량 (임시로 숫자 넣어둠)*/}
>>>>>>> e9d1a50109e7c50d519d53a0e37f636e3da4d0cf
          <div className="gen-card-value">{genProgress === 100 ? `${estimatedSize} MB` : '계산중...'}</div>
        </div>

        <div className="gen-card" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="gen-card-title">생성 대상 파일 목록</div>
          <div className="gen-file-list">
            {targetFileIds.map(id => {
              const file = files.find(f => f.id === id);
              return (
                <div key={id} className="gen-file-item">
                  ● {file?.name}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="gen-main-area">
        {genProgress < 100 ? (
          <div className="gen-loading-container">
            <div className="gen-spinner"></div>
            <div className="gen-loading-text">잠시만 기다려 주세요...</div>
          </div>
        ) : (
          <div className="gen-complete-container">
            {/*<div className="gen-complete-icon">🎉</div>*/}
            <div className="gen-complete-title">코드 생성이 완료되었습니다!</div>
            <div className="gen-complete-desc">좌측 패널에서 생성한 파일 상세 정보를 확인하거나 다시 프로젝트로 돌아갈 수 있습니다.</div>
            <button className="gen-action-btn" onClick={onBack}>BACK</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Generate;