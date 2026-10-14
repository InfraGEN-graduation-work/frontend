import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { FileGroup, NodeData } from '../types';

interface GenerateProps {
  genProgress: number;
  targetFileIds: string[];
  files: FileGroup[];
  projectName: string;
  onBack: () => void;
  nodes: NodeData[];
  nodeJsGuide?: { local: boolean; cloud: boolean } | null;
  mongoGuide?: { nodeJs: boolean; cloud: boolean } | null;
}

const guideBoxStyle: React.CSSProperties = { marginTop: '28px', width: '100%', maxWidth: '560px', textAlign: 'left', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', fontSize: '13px', color: '#4a5568', lineHeight: 1.7, wordBreak: 'keep-all' };
const guideTitleStyle: React.CSSProperties = { fontSize: '14px', fontWeight: 700, color: '#2d3748', marginBottom: '8px' };
const guideSubTitleStyle: React.CSSProperties = { fontWeight: 700, color: '#2d3748', marginTop: '10px' };
const guideCodeStyle: React.CSSProperties = { display: 'block', margin: '6px 0', padding: '8px 10px', background: '#2d3748', color: '#f7fafc', borderRadius: '6px', fontFamily: "'Consolas', 'Courier New', monospace", fontSize: '12px', userSelect: 'text' };
const guideListStyle: React.CSSProperties = { margin: '4px 0 0', paddingLeft: '18px' };

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const Generate: React.FC<GenerateProps> = ({ genProgress, targetFileIds, files, projectName, onBack, nodes, nodeJsGuide, mongoGuide }) => {
  const targetNodes = targetFileIds.flatMap(fileId => {
    const file = files.find(f => f.id === fileId);
    return (file?.nodeIds || [])
      .map(nodeId => nodes.find(n => n.id === nodeId))
      .filter((n): n is NodeData => Boolean(n));
  });

  const generatedFiles = targetFileIds.flatMap(fileId => files.find(f => f.id === fileId)?.generatedFiles || []);
  const generatedKey = generatedFiles.map(gf => `${gf.fileName}:${(gf.content || '').length}`).join('|');
  const [zipSize, setZipSize] = useState<number | null>(null);

  const buildZip = () => {
    const zip = new JSZip();
    generatedFiles.forEach(gf => {
      zip.file(`${projectName}/${gf.fileName}`, gf.content);
    });
    return zip;
  };

  useEffect(() => {
    if (genProgress < 100) {
      setZipSize(null);
      return;
    }
    if (generatedFiles.length === 0) {
      setZipSize(0);
      return;
    }
    let cancelled = false;
    buildZip().generateAsync({ type: 'blob' })
      .then((blob: Blob) => { if (!cancelled) setZipSize(blob.size); })
      .catch(() => { if (!cancelled) setZipSize(new Blob(generatedFiles.map(gf => gf.content || '')).size); });
    return () => { cancelled = true; };
  }, [genProgress, generatedKey, projectName]);

  const handleDownload = async () => {
    if (generatedFiles.length > 0) {
      const content = await buildZip().generateAsync({ type: "blob" });
      saveAs(content, `${projectName}-infragen-export.zip`);
    } else {
      window.dispatchEvent(new CustomEvent('global-toast', { detail: '다운로드할 코드가 없습니다.' }));
    }
  };

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
          <div className="gen-card-value">{projectName}</div> 
        </div>

        <div className="gen-card">
          <div className="gen-card-title">파일 개수</div>
          <div className="gen-card-value">{genProgress === 100 ? `${generatedFiles.length}개` : '계산중...'}</div>
        </div>

        <div className="gen-card">
          <div className="gen-card-title">예상 용량</div>
          <div className="gen-card-value">{genProgress === 100 && zipSize !== null ? formatBytes(zipSize) : '계산중...'}</div>
        </div>

        <div className="gen-card" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="gen-card-title">생성할 노드 목록</div>
          <div className="gen-file-list">
            {targetNodes.length > 0 ? targetNodes.map(node => (
              <div key={node.id} className="gen-file-item gen-node-item">
                ● {node.name}
              </div>
            )) : (
              <div className="gen-file-item">생성할 노드가 없습니다.</div>
            )}
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
            <div className="gen-complete-title">코드 생성이 완료되었습니다!</div>
            <div className="gen-complete-desc">좌측 패널에서 생성한 파일 상세 정보를 확인하거나 다운로드 받을 수 있습니다.</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="gen-action-btn" onClick={handleDownload} style={{ background: '#4a5568' }}>다운로드</button>
              <button className="gen-action-btn" onClick={onBack}>돌아가기</button>
            </div>
            {nodeJsGuide && (nodeJsGuide.local || nodeJsGuide.cloud) && (
              <div className="node-js-guide" style={guideBoxStyle}>
                <div style={guideTitleStyle}>Node.js 앱 실행 안내</div>
                <div>생성된 코드에는 앱 코드가 들어 있지 않습니다. 아래 내용을 직접 준비해 주세요.</div>
                {nodeJsGuide.local && (
                  <>
                    <div style={guideSubTitleStyle}>내 PC에서 실행할 때</div>
                    <ul style={guideListStyle}>
                      <li>로컬용 docker-compose에는 DB만 들어 있고, 앱은 내 PC에서 직접 실행합니다.</li>
                      <li>Node.js는 local/.env 파일을 자동으로 읽지 않습니다. 실행할 때 지정하거나(Node.js 20.6 이상), 앱에서 dotenv로 읽어 주세요.</li>
                    </ul>
                    <code style={guideCodeStyle}>node --env-file=local/.env server.js</code>
                  </>
                )}
                {nodeJsGuide.cloud && (
                  <>
                    <div style={guideSubTitleStyle}>클라우드에 배포할 때</div>
                    <ul style={guideListStyle}>
                      <li>cloud 폴더에 package.json, package-lock.json, 앱 파일을 넣어 주세요. package-lock.json이 없으면 빌드가 실패하고, yarn·pnpm은 지원하지 않습니다.</li>
                      <li>앱은 package.json의 start 스크립트로 실행됩니다. start 스크립트가 없으면 실행에 실패합니다.</li>
                      <li>start 스크립트는 "exec node server.js"처럼 exec로 시작해야 서버를 멈출 때 종료 신호가 앱에 전달됩니다.</li>
                      <li>앱은 process.env.PORT로 포트를 열어야 노드에 입력한 포트와 연결됩니다.</li>
                      <li>TypeScript처럼 빌드가 필요한 앱은 미리 빌드한 결과물을 넣어 주세요.</li>
                    </ul>
                  </>
                )}
              </div>
            )}
            {mongoGuide && (mongoGuide.nodeJs || mongoGuide.cloud) && (
              <div className="mongodb-guide" style={guideBoxStyle}>
                <div style={guideTitleStyle}>MongoDB 연결 안내</div>
                {mongoGuide.nodeJs && (
                  <>
                    <div style={guideSubTitleStyle}>Node.js 앱에서 접속할 때</div>
                    <ul style={guideListStyle}>
                      <li>Node.js 앱은 접속 주소를 직접 만들어야 합니다. 아래 대문자 자리에 .env의 같은 이름 값을 넣어 주세요.</li>
                      <li>인증 DB는 admin입니다. authSource=admin을 빼면 로그인에 실패합니다.</li>
                    </ul>
                    <code style={guideCodeStyle}>mongodb://MONGO_USER:MONGO_PASSWORD@MONGO_HOST:MONGO_PORT/MONGO_DATABASE?authSource=admin</code>
                  </>
                )}
                {mongoGuide.cloud && (
                  <>
                    <div style={guideSubTitleStyle}>클라우드에 배포할 때</div>
                    <ul style={guideListStyle}>
                      <li>서버의 .env 파일에 MONGO_DATABASE, MONGO_USER, MONGO_PASSWORD 세 값을 꼭 넣어 주세요. 하나라도 없으면 docker compose up이 시작하기 전에 실패합니다.</li>
                      <li>클라우드에는 앱에 연결된 MongoDB만 들어가고, 앱은 mongodb:27017로 접속합니다. 노드에 입력한 포트는 쓰이지 않습니다.</li>
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Generate;