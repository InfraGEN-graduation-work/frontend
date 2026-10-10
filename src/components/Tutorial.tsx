import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './Tutorial.css';

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type TooltipPlacement = 'right' | 'bottom' | 'left' | 'top' | 'bottom-center' | 'top-right' | 'center';

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
    description: '먼저 설정할 노드 하나를 클릭하세요',
    targetSelector: '.deployed-nodes-group',
    tooltipPlacement: 'left',
    noDim: true,
    // 노드를 클릭했는지는 goNext에서 selectedNodeIds로 확인한다.
    // 클릭하지 않고 '다음'을 누르면 경고 문구만 띄우고 진행하지 않는다.
  },
  {
    step: '5',
    title: '튜토리얼 5단계',
    description: 'Settings 버튼을 클릭하세요',
    targetSelector: '.tabs .tab:nth-child(2)',
    tooltipPlacement: 'bottom',
    advanceOn: { selector: '.tabs .tab:nth-child(2)', event: 'click' },
  },
  {
    step: '6',
    title: '튜토리얼 6단계',
    description: '노드를 설정하세요',
    subText: "설정을 입력한 후 '다음' 버튼을 누르세요",
    targetSelector: '.settings-panel',
    tooltipPlacement: 'top-right',
    arrowText: '설정을 완료하세요',
    arrowDirection: 'down',
  },
  {
    step: '7',
    title: '튜토리얼 7단계',
    description: 'Project 버튼을 클릭하세요',
    targetSelector: '.tabs .tab:nth-child(1)',
    tooltipPlacement: 'bottom',
    advanceOn: { selector: '.tabs .tab:nth-child(1)', event: 'click' },
  },
  {
    step: '8',
    title: '튜토리얼 8단계',
    description: '생성할 노드 목록을 확인해주세요',
    subText: '확인하였으면 다음 버튼을 눌러주세요',
    targetSelector: '#field-target-file-box',
    tooltipPlacement: 'left',
  },
  {
    step: '9',
    title: '튜토리얼 9단계',
    description: '노드를 완성하셨으면\nGenerate 버튼을 클릭하세요',
    targetSelector: '.generate-btn',
    tooltipPlacement: 'bottom',
    // 클릭하면 항상 10단계로 이동한다.
    // 10단계의 내용은 오류 유무에 따라 달라진다(NO_ERROR_STEP_10 참고).
    advanceOn: { selector: '.generate-btn', event: 'click' },
  },
  {
    step: '10',
    title: '튜토리얼 10단계',
    description: '오류가 있어 프로젝트를 생성할 수 없습니다.\n확인 버튼을 클릭하세요',
    targetSelector: '#error-modal-confirm-btn',
    tooltipPlacement: 'left',
    noDim: true,
    advanceOn: { selector: '#error-modal-confirm-btn', event: 'click' },
  },
  {
    step: '11',
    title: '튜토리얼 11단계',
    description: '오류 항목을 클릭하면\n문제가 있는 위치로 이동합니다',
    subText: '오류 목록에서 항목을 하나 클릭해주세요',
    targetSelector: '.validation-panel',
    tooltipPlacement: 'left',
    advanceOn: { selector: '.error-box', event: 'click' },
  },
  {
    step: '12',
    title: '튜토리얼 12단계',
    description: '표시된 위치에서\n오류를 모두 수정해주세요',
    subText: "수정이 끝나면 '다음' 버튼을 눌러주세요",
    targetSelector: '.right-sidebar',
    tooltipPlacement: 'left',
    noDim: true,
    // 별도 advanceOn 없음: '다음' 클릭 시 goNext에서 hasErrors를 검사해
    // 아직 오류가 남아있으면 경고 문구만 띄우고 진행하지 않는다.
  },
  {
    step: '13',
    title: '튜토리얼 13단계',
    description: '모든 준비가 끝났다면\nGenerate 버튼을 다시 클릭하세요',
    targetSelector: '.generate-btn',
    tooltipPlacement: 'bottom',
    advanceOn: { selector: '.generate-btn', event: 'click' },
  },
  {
    step: '14',
    title: '튜토리얼 14단계',
    description: '생성 버튼을 클릭하세요',
    subText: '프로젝트 생성이 시작됩니다',
    targetSelector: '#generate-confirm-btn',
    tooltipPlacement: 'left',
    noDim: true,
    advanceOn: { selector: '#generate-confirm-btn', event: 'click' },
  },
  {
    step: '15',
    title: '튜토리얼 완료!',
    description: 'Generate까지 완료했습니다.\n이제 infraGEN을 자유롭게 사용해 보세요.',
    targetSelector: '',
    tooltipPlacement: 'bottom-center',
    isFinale: true,
  },
];

// 9단계에서 Generate를 눌렀을 때 오류가 없으면, 10단계를 오류 안내 대신
// '생성 확인 모달의 생성 버튼 클릭' 안내로 바꿔서 보여준다. (14단계와 같은 내용)
// 이 경우 생성 버튼을 누르면 11~14단계를 건너뛰고 바로 완료 화면으로 이동한다.
const NO_ERROR_STEP_10: Partial<TutorialStepConfig> = {
  description: '생성 버튼을 클릭하세요',
  subText: '프로젝트 생성이 시작됩니다',
  targetSelector: '#generate-confirm-btn',
  tooltipPlacement: 'left',
  noDim: true,
  advanceOn: { selector: '#generate-confirm-btn', event: 'click' },
};

const TOTAL_VISIBLE = STEPS.filter(s => !s.isFinale).length;
const PADDING = 8;
const TOOLTIP_GAP = 14;

interface Props {
  onFinish: () => void;
  onSkip?: () => void;
  nodes?: { id: string }[];
  selectedNodeIds?: string[];
  hasErrors?: boolean;
  onJumpToNextError?: () => void;
}

const Tutorial: React.FC<Props> = ({ onFinish, onSkip, nodes = [], selectedNodeIds = [], hasErrors = false, onJumpToNextError }) => {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hl, setHl] = useState<HighlightRect | null>(null);
  const [canvasCenter, setCanvasCenter] = useState<{ x: number; y: number } | null>(null);
  const [dropTargetVisible, setDropTargetVisible] = useState(true);
  const [showNodeWarning, setShowNodeWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  // 9단계에서 Generate를 눌렀을 때 오류가 없었는지 여부
  const [noErrorFlow, setNoErrorFlow] = useState(false);

  const baseStep = STEPS[idx];
  // measure/useEffect 의존성이므로 useMemo로 참조를 고정한다(매 렌더 새 객체면 무한 루프).
  const step = useMemo<TutorialStepConfig>(
    () => (noErrorFlow && baseStep.step === '10' ? { ...baseStep, ...NO_ERROR_STEP_10 } : baseStep),
    [baseStep, noErrorFlow]
  );
  const isLast = idx === STEPS.length - 1;

  // 진행 점(dots) 표시 위치.
  // 오류 없음 흐름의 10단계는 11~14단계를 건너뛰고 바로 완료로 가는 마지막 단계이므로
  // 14단계(생성 버튼 클릭)와 같은 마지막 점을 활성화한다.
  const activeDotIdx = noErrorFlow && baseStep.step === '10' ? TOTAL_VISIBLE - 1 : idx;

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

  const showWarning = useCallback((message: string) => {
    setWarningMessage(message);
    setShowNodeWarning(true);
    setTimeout(() => setShowNodeWarning(false), 2500);
  }, []);

  const goNext = useCallback(() => {
    const currentStep = STEPS[idx].step;

    if (currentStep === '2' && nodes.length < 2) {
      showWarning('2개 이상의 노드를 보드에 놓아주세요!');
      return;
    }

    if (currentStep === '4' && selectedNodeIds.length === 0) {
      showWarning('설정할 노드를 먼저 클릭해주세요!');
      return;
    }

    if (currentStep === '12' && hasErrors) {
      if (onJumpToNextError) {
        // 경고를 띄우는 대신, 아직 설정이 안 된 다음 노드의 Settings로 바로 이동한다.
        // 12단계는 그대로 유지되고(advance하지 않음), 모든 오류가 사라지면
        // 그다음 '다음' 클릭에서 13단계로 넘어간다.
        onJumpToNextError();
      } else {
        showWarning('아직 수정되지 않은 오류가 있습니다!');
      }
      return;
    }

    setShowNodeWarning(false);

    // 9단계: 오류 유무를 기록하고 10단계로 이동한다(아래 기본 +1 이동).
    // 오류가 없으면 10단계가 '생성 버튼 클릭' 안내로, 있으면 '오류 확인' 안내로 표시된다.
    if (currentStep === '9') setNoErrorFlow(!hasErrors);

    // 10단계(오류 없음 흐름): 생성 버튼을 눌렀으므로 11~14단계를 건너뛰고 완료 화면으로 이동한다.
    if (currentStep === '10' && noErrorFlow) {
      const finaleIdx = STEPS.findIndex(s => s.isFinale);
      if (finaleIdx !== -1) {
        setVisible(false);
        setTimeout(() => { setIdx(finaleIdx); setVisible(false); }, 320);
        return;
      }
    }

    // 13단계(오류 흐름): Generate 재클릭 시 오류가 남아 있으면 다시 10단계(오류 확인),
    // 없으면 14단계(생성 확인)로 이동한다.
    if (currentStep === '13') {
      const targetStepId = hasErrors ? '10' : '14';
      const targetIdx = STEPS.findIndex(s => s.step === targetStepId);
      if (targetIdx !== -1) {
        setVisible(false);
        setTimeout(() => { setIdx(targetIdx); setVisible(false); }, 320);
        return;
      }
    }

    if (isLast) { setVisible(false); setTimeout(onFinish, 300); return; }
    setVisible(false);
    setTimeout(() => { setIdx(p => p + 1); setVisible(false); }, 320);
  }, [isLast, onFinish, idx, noErrorFlow, nodes.length, selectedNodeIds, hasErrors, showWarning, onJumpToNextError]);

  const goBack = useCallback(() => {
    if (idx === 0) return;
    setShowNodeWarning(false);
    setVisible(false);
    setTimeout(() => { setIdx(p => p - 1); setVisible(false); }, 320);
  }, [idx]);

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
    setVisible(false); setHl(null); setCanvasCenter(null); setDropTargetVisible(true); setShowNodeWarning(false);
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
      case 'left':         return { top: top + (step.step === '12' ? 260 : 0), right: window.innerWidth - left + TOOLTIP_GAP };
      case 'bottom':       return { top: top + height + TOOLTIP_GAP, left };
      case 'top':          return { bottom: window.innerHeight - top + TOOLTIP_GAP, left };
      case 'bottom-center':return { top: top + height + TOOLTIP_GAP, left: left + width / 2, transform: 'translateX(-50%)' };
      case 'top-right':    return { bottom: window.innerHeight - top + TOOLTIP_GAP, right: window.innerWidth - (left + width) };
      case 'center':        return { top: top + height / 2, left: left + width / 2, transform: 'translate(-50%,-50%)' };
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
                <span key={i} className={`tutorial-dot ${i === activeDotIdx ? 'active' : ''}`} />
              ))}
            </div>
            <div className="tutorial-tooltip-actions">
              {idx > 0 && (
                <button type="button" className="tutorial-back-btn" onClick={goBack} title="이전 단계" aria-label="이전 단계">
                  ←
                </button>
              )}
              <button type="button" className="tutorial-skip-btn tutorial-skip-inline" onClick={handleSkip}>
                건너뛰기
              </button>
              {step.step !== '5' && step.step !== '7' && step.step !== '9' &&
               step.step !== '10' && step.step !== '11' && step.step !== '13' && step.step !== '14' && (
                <button type="button" className="tutorial-next-btn tutorial-next-inline" onClick={goNext}>
                  {isLast ? '완료' : '다음'}
                </button>
              )}
            </div>
          </div>
          {showNodeWarning && (
            <div className="tutorial-inline-warning">
              {warningMessage}
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