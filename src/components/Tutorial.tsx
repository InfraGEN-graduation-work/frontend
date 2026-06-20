import React, { useState, useEffect, useCallback } from 'react';
import './Tutorial.css';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type TooltipPlacement = 'right' | 'bottom' | 'left' | 'top' | 'bottom-center' | 'top-right';

interface TutorialStepConfig {
  step: string;
  title: string;
  description: string;
  subText?: string;
  targetSelector: string;
  tooltipPlacement: TooltipPlacement;
  arrowText?: string;
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
  showDropTarget?: boolean;
  dropTargetSelector?: string;
  advanceOn?: { selector: string; event: string };
  noDim?: boolean;
  isFinale?: boolean;
}

const STEPS: TutorialStepConfig[] = [
  {
    step: '1',
    title: '튜토리얼 1단계',
    description: 'NodeBox에서 사용할 노드를 클릭하세요',
    targetSelector: '.category-list',
    tooltipPlacement: 'right',
    arrowText: '노드를 클릭하세요',
    arrowDirection: 'left',
    advanceOn: { selector: '.category-item', event: 'click' },
  },
  {
    step: '2',
    title: '튜토리얼 2단계',
    description: '노드를 2개 이상 보드에 드래그 앤 드롭하세요',
    subText: '배치가 끝나면 다음을 누르세요.',
    targetSelector: '.category-list',
    tooltipPlacement: 'right',
    noDim: true,
  },
  {
    step: '3',
    title: '튜토리얼 3단계',
    description: '보드에 놓인 노드들을 연결하세요',
    subText: '연결할 노드에 우클릭하여 연결을 시작하세요\n다 연결했으면 다음 버튼을 눌러주세요',
    targetSelector: '.deployed-nodes-group',
    tooltipPlacement: 'left',
    noDim: true,
  },
  {
    step: '4',
    title: '튜토리얼 4단계',
    description: 'Settings 버튼을 클릭하세요',
    targetSelector: '.tabs .tab:nth-child(2)',
    tooltipPlacement: 'bottom',
    advanceOn: { selector: '.tabs .tab:nth-child(2)', event: 'click' },
  },
  {
    step: '5',
    title: '튜토리얼 5단계',
    description: '노드를 설정하세요',
    subText: "설정을 입력한 후 '다음' 버튼을 누르세요",
    targetSelector: '.settings-panel',
    tooltipPlacement: 'top-right',
    arrowText: '설정을 완료하세요',
    arrowDirection: 'down',
  },
  {
    step: '6',
    title: '튜토리얼 6단계',
    description: '노드를 완성하셨으면\nGenerate 버튼을 클릭하세요',
    targetSelector: '.generate-btn',
    tooltipPlacement: 'bottom',
    advanceOn: { selector: '.generate-btn', event: 'click' },
  },
  {
    step: '7',
    title: '튜토리얼 완료!',
    description: 'Generate까지 완료했습니다.\n이제 infraGEN을 자유롭게 사용해 보세요.',
    targetSelector: '',
    tooltipPlacement: 'bottom-center',
    isFinale: true,
  },
];

const TOTAL_VISIBLE = STEPS.filter(s => !s.isFinale).length;
const PADDING = 8;
const TOOLTIP_GAP = 14;

interface Props { onFinish: () => void; onSkip?: () => void; nodes?: { id: string }[]; }

const Tutorial: React.FC<Props> = ({ onFinish, onSkip, nodes = [] }) => {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hl, setHl] = useState<HighlightRect | null>(null);
  const [canvasCenter, setCanvasCenter] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetVisible, setDropTargetVisible] = useState(true);
  const [showNodeWarning, setShowNodeWarning] = useState(false);

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  const measure = useCallback(() => {
    if (!step.targetSelector) { setHl(null); return; }

    if (step.targetSelector === '.deployed-nodes-group') {
      const nodeEls = document.querySelectorAll('.deployed-node');
      if (nodeEls.length === 0) { setHl(null); return; }
      let minTop = Infinity, minLeft = Infinity, maxBottom = -Infinity, maxRight = -Infinity;
      nodeEls.forEach(el => {
        const r = el.getBoundingClientRect();
        minTop = Math.min(minTop, r.top);
        minLeft = Math.min(minLeft, r.left);
        maxBottom = Math.max(maxBottom, r.bottom);
        maxRight = Math.max(maxRight, r.right);
      });
      const PAD = 20;
      setHl({ top: minTop - PAD, left: minLeft - PAD, width: maxRight - minLeft + PAD * 2, height: maxBottom - minTop + PAD * 2 });
      setCanvasCenter(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHl({ top: r.top - PADDING, left: r.left - PADDING, width: r.width + PADDING * 2, height: r.height + PADDING * 2 });

    if (step.showDropTarget && step.dropTargetSelector) {
      const cv = document.querySelector(step.dropTargetSelector);
      if (cv) {
        const cr = cv.getBoundingClientRect();
        setCanvasCenter({ x: cr.left + cr.width * 0.55, y: cr.top + cr.height * 0.38 });
      }
    } else {
      setCanvasCenter(null);
    }
  }, [step]);

  const goNext = useCallback(() => {
    if (STEPS[idx].step === '2' && nodes.length < 2) {
      setShowNodeWarning(true);
      setTimeout(() => setShowNodeWarning(false), 2500);
      return;
    }
    setShowNodeWarning(false);
    if (isLast) { setVisible(false); setTimeout(onFinish, 300); return; }
    setVisible(false);
    setTimeout(() => { setIdx(p => p + 1); setVisible(false); }, 320);
  }, [isLast, onFinish, idx, nodes.length]);

  useEffect(() => {
    if (!step.advanceOn) return;
    const { selector, event } = step.advanceOn;
    const handler = (e: Event) => {
      const t = e.target as Element;
      if (t?.closest(selector) || document.querySelector(selector)?.contains(t)) {
        setTimeout(goNext, 350);
      }
    };
    document.addEventListener(event, handler, true);
    let deHandler: ((e: Event) => void) | null = null;
    if (event === 'drop') {
      deHandler = (e: Event) => {
        if ((e as DragEvent).dataTransfer?.dropEffect !== 'none') setTimeout(goNext, 350);
      };
      document.addEventListener('dragend', deHandler, true);
    }
    return () => {
      document.removeEventListener(event, handler, true);
      if (deHandler) document.removeEventListener('dragend', deHandler, true);
    };
  }, [idx, step.advanceOn, goNext]);

  useEffect(() => {
    if (!step.showDropTarget) return;

    const hide = () => {
      setDropTargetVisible(false);
      setCanvasCenter(null);
    };

    const onDrop = (e: Event) => {
      const target = e.target as Element;
      if (target?.closest('.canvas-viewport')) hide();
    };

    const onDragEnd = (e: Event) => {
      if ((e as DragEvent).dataTransfer?.dropEffect !== 'none') hide();
    };

    document.addEventListener('drop', onDrop, true);
    document.addEventListener('dragend', onDragEnd, true);
    return () => {
      document.removeEventListener('drop', onDrop, true);
      document.removeEventListener('dragend', onDragEnd, true);
    };
  }, [idx, step.showDropTarget]);

  useEffect(() => {
    const obs = new MutationObserver(() => setTimeout(measure, 60));
    const panel = document.querySelector('.left-panel, aside');
    const canvas = document.querySelector('.canvas-viewport');
    if (panel) obs.observe(panel, { childList: true, subtree: true });
    if (canvas) {
      obs.observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
      canvas.addEventListener('scroll', measure);
    }
    return () => {
      obs.disconnect();
      canvas?.removeEventListener('scroll', measure);
    };
  }, [idx, measure]);

  useEffect(() => {
    setVisible(false); setHl(null); setCanvasCenter(null); setDropTargetVisible(true);
    measure();
    window.addEventListener('resize', measure);
    const t = setTimeout(() => setVisible(true), 100);
    return () => { window.removeEventListener('resize', measure); clearTimeout(t); };
  }, [idx, measure]);

  const tooltipStyle = (): React.CSSProperties => {
    if (!hl) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
    const { top, left, width, height } = hl;
    switch (step.tooltipPlacement) {
      case 'right':        return { top, left: left + width + TOOLTIP_GAP };
      case 'left':         return { top, right: window.innerWidth - left + TOOLTIP_GAP };
      case 'bottom':       return { top: top + height + TOOLTIP_GAP, left };
      case 'top':          return { bottom: window.innerHeight - top + TOOLTIP_GAP, left };
      case 'bottom-center':return { top: top + height + TOOLTIP_GAP, left: left + width / 2, transform: 'translateX(-50%)' };
      case 'top-right':    return { bottom: window.innerHeight - top + TOOLTIP_GAP, right: window.innerWidth - (left + width) };
      default:             return { top, left: left + width + TOOLTIP_GAP };
    }
  };

  const connPts = (() => {
    if (!step.showDropTarget || !hl || !canvasCenter) return null;
    const tipW = 200;
    return {
      fx: hl.left + hl.width + TOOLTIP_GAP + tipW,
      fy: hl.top + 30,
      tx: canvasCenter.x,
      ty: canvasCenter.y,
    };
  })();

  const handleSkip = () => { setVisible(false); setTimeout(() => (onSkip ?? onFinish)(), 300); };

  if (step.isFinale) {
    return (
      <div className="tutorial-overlay-wrapper">
        <div className={`tutorial-dim tutorial-dim-full ${visible ? 'visible' : ''}`} />
        <div className={`tutorial-finale-modal ${visible ? 'visible' : ''}`}>
          <div className="finale-emoji">🎉</div>
          <div className="finale-title">{step.title}</div>
          <div className="finale-desc">{step.description}</div>
          <div className="tutorial-dots finale-dots">
            {STEPS.filter(s => !s.isFinale).map((_, i) => (
              <span key={i} className="tutorial-dot active" />
            ))}
          </div>
          <button className="tutorial-next-btn finale-btn" onClick={() => { setVisible(false); setTimeout(onFinish, 300); }}>
            시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tutorial-overlay-wrapper">
      {!step.noDim && (hl ? (
        <>
          <div className={`tutorial-dim ${visible ? 'visible' : ''}`} style={{ top: 0, left: 0, right: 0, height: hl.top }} />
          <div className={`tutorial-dim ${visible ? 'visible' : ''}`} style={{ top: hl.top + hl.height, left: 0, right: 0, bottom: 0 }} />
          <div className={`tutorial-dim ${visible ? 'visible' : ''}`} style={{ top: hl.top, left: 0, width: hl.left, height: hl.height }} />
          <div className={`tutorial-dim ${visible ? 'visible' : ''}`} style={{ top: hl.top, left: hl.left + hl.width, right: 0, height: hl.height }} />
        </>
      ) : (
        <div className={`tutorial-dim tutorial-dim-full ${visible ? 'visible' : ''}`} />
      ))}

      <svg className={`tutorial-svg ${visible ? 'visible' : ''}`} xmlns="http://www.w3.org/2000/svg">
        {hl && !step.noDim && (
          <rect x={hl.left} y={hl.top} width={hl.width} height={hl.height}
            rx="8" fill="none" stroke="#5fcfad" strokeWidth="2" strokeDasharray="5 3"
            className="tutorial-highlight-border" />
        )}
        {connPts && visible && (
          <path
            d={`M ${connPts.fx} ${connPts.fy} C ${connPts.fx + 60} ${connPts.fy}, ${connPts.tx - 60} ${connPts.ty}, ${connPts.tx} ${connPts.ty}`}
            fill="none" stroke="#5fcfad" strokeWidth="1.5" strokeDasharray="5 3"
            className="tutorial-connector-line" />
        )}
      </svg>

      {canvasCenter && visible && dropTargetVisible && (
        <div className={`tutorial-drop-target ${visible ? 'visible' : ''}`}
          style={{ top: canvasCenter.y, left: canvasCenter.x }}>
          <div className="drop-target-icon">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <rect x="2" y="2" width="26" height="26" rx="6" stroke="#5fcfad" strokeWidth="1.8" strokeDasharray="4 2"/>
              <path d="M15 8 L15 22 M10 17 L15 22 L20 17" stroke="#5fcfad" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="drop-target-label">여기에 드롭</span>
        </div>
      )}


      <div className={`tutorial-tooltip placement-${step.tooltipPlacement} ${visible ? 'visible' : ''}`}
        style={tooltipStyle()}>
        <div className="tooltip-tail" />

        <div className="tutorial-tooltip-inner">
          <div className="tutorial-step-badge">튜토리얼 {step.step}단계</div>
          <div className="tutorial-description">{step.description}</div>
          {step.subText && <div className="tutorial-subtext">{step.subText}</div>}
          <div className="tutorial-tooltip-footer">
            <div className="tutorial-dots">
              {Array.from({ length: TOTAL_VISIBLE }).map((_, i) => (
                <span key={i} className={`tutorial-dot ${i === idx ? 'active' : ''}`} />
              ))}
            </div>
            <div className="tutorial-tooltip-actions">
              <button type="button" className="tutorial-skip-btn tutorial-skip-inline" onClick={handleSkip}>
                건너뛰기
              </button>
              {step.step !== '6' && step.step !== '4' && (
                <button type="button" className="tutorial-next-btn tutorial-next-inline" onClick={goNext}>
                  {isLast ? '완료' : '다음'}
                </button>
              )}
            </div>
          </div>
          {showNodeWarning && (
            <div className="tutorial-inline-warning">
              2개 이상의 노드를 보드에 놓아주세요!
            </div>
          )}
        </div>

        {step.arrowText && (
          <div className={`tutorial-arrow-text dir-${step.arrowDirection ?? 'left'}`}>
            {step.arrowDirection === 'up' && <span className="arrow-icon">↑</span>}
            {(!step.arrowDirection || step.arrowDirection === 'left') && <span className="arrow-icon">←</span>}
            {step.arrowDirection !== 'up' && <span>{step.arrowText}</span>}
            {step.arrowDirection === 'down' && <span className="arrow-icon">↓</span>}
          </div>
        )}
      </div>

    </div>
  );
};

export default Tutorial;