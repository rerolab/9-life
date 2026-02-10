import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, useRef, useCallback } from "react";

interface RouletteProps {
  show: boolean;
  result: number | null;
  onSpin: () => void;
  onDone?: () => void;
}

const SEGMENTS = 10;
const SEG_ANGLE = 360 / SEGMENTS;
const SEG_COLORS = [
  "#e60012", "#0ab5f5", "#f5c518", "#4fc436", "#ff922b",
  "#cc5de8", "#e60012", "#0ab5f5", "#f5c518", "#4fc436",
];

const CX = 100;
const CY = 110;
const R = 85;
const LABEL_R = R * 0.62;
const PEG_R = R + 6;
const DECEL_DURATION = 2200;
const DISMISS_DELAY = 1200;

type WheelPhase = "idle" | "spinning" | "stopping" | "result";

function segmentPath(i: number): string {
  const s = ((i * SEG_ANGLE - 90) * Math.PI) / 180;
  const e = (((i + 1) * SEG_ANGLE - 90) * Math.PI) / 180;
  return `M ${CX} ${CY} L ${CX + R * Math.cos(s)} ${CY + R * Math.sin(s)} A ${R} ${R} 0 0 1 ${CX + R * Math.cos(e)} ${CY + R * Math.sin(e)} Z`;
}

const segments = Array.from({ length: SEGMENTS }, (_, i) => {
  const mid = ((i * SEG_ANGLE + SEG_ANGLE / 2 - 90) * Math.PI) / 180;
  return {
    path: segmentPath(i),
    color: SEG_COLORS[i],
    lx: CX + LABEL_R * Math.cos(mid),
    ly: CY + LABEL_R * Math.sin(mid),
    labelAngle: i * SEG_ANGLE + SEG_ANGLE / 2,
    number: i + 1,
  };
});

const pegs = Array.from({ length: 20 }, (_, i) => {
  const rad = ((i * 18 - 90) * Math.PI) / 180;
  return { x: CX + PEG_R * Math.cos(rad), y: CY + PEG_R * Math.sin(rad) };
});

export default function Roulette({ show, result, onSpin, onDone }: RouletteProps) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<WheelPhase>("idle");
  const [showResult, setShowResult] = useState<number | null>(null);
  // Latched result: once received, kept until animation completes
  const [latchedResult, setLatchedResult] = useState<number | null>(null);

  const wheelRef = useRef<SVGGElement>(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef(0);
  const phaseRef = useRef<WheelPhase>("idle");
  const resultRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const decelStartAngle = useRef(0);
  const decelTargetAngle = useRef(0);
  const decelStartTime = useRef(0);

  // Latch visible on
  useEffect(() => {
    if (show) {
      setVisible(true);
      setShowResult(null);
      setLatchedResult(null);
      resultRef.current = null;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    }
  }, [show]);

  // Latch result: only store, never clear from prop (cleared on dismiss)
  useEffect(() => {
    if (result !== null) {
      setLatchedResult(result);
      resultRef.current = result;
    }
  }, [result]);

  const updateWheel = useCallback(() => {
    wheelRef.current?.setAttribute(
      "transform",
      `rotate(${angleRef.current} ${CX} ${CY})`,
    );
  }, []);

  const computeTarget = useCallback((current: number, num: number) => {
    const targetR = (360 - ((num - 1) * SEG_ANGLE + SEG_ANGLE / 2) + 360) % 360;
    const currentR = ((current % 360) + 360) % 360;
    let delta = targetR - currentR;
    if (delta < 0) delta += 360;
    return current + delta + 720;
  }, []);

  const dismiss = useCallback(() => {
    phaseRef.current = "idle";
    setPhase("idle");
    setShowResult(null);
    setLatchedResult(null);
    resultRef.current = null;
    setVisible(false);
    onDoneRef.current?.();
  }, []);

  const startLoop = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;

    const tick = () => {
      if (!isActiveRef.current) return;

      if (phaseRef.current === "spinning") {
        velocityRef.current = Math.min(velocityRef.current + 0.4, 14);
        angleRef.current += velocityRef.current;
        updateWheel();
        rafRef.current = requestAnimationFrame(tick);
      } else if (phaseRef.current === "stopping") {
        const elapsed = performance.now() - decelStartTime.current;
        const progress = Math.min(elapsed / DECEL_DURATION, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        angleRef.current =
          decelStartAngle.current +
          (decelTargetAngle.current - decelStartAngle.current) * eased;
        updateWheel();

        if (progress >= 1) {
          isActiveRef.current = false;
          phaseRef.current = "result";
          setPhase("result");
          setShowResult(resultRef.current);
          // Auto-dismiss after delay
          dismissTimer.current = setTimeout(dismiss, DISMISS_DELAY);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      } else {
        isActiveRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [updateWheel, dismiss]);

  const handleSpin = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    phaseRef.current = "spinning";
    setPhase("spinning");
    velocityRef.current = 0;
    setShowResult(null);
    onSpin();
    startLoop();
  }, [onSpin, startLoop]);

  const handleStop = useCallback(() => {
    if (phaseRef.current !== "spinning" || resultRef.current === null) return;
    phaseRef.current = "stopping";
    setPhase("stopping");
    decelStartAngle.current = angleRef.current;
    decelTargetAngle.current = computeTarget(angleRef.current, resultRef.current);
    decelStartTime.current = performance.now();
  }, [computeTarget]);

  // Safety auto-stop
  useEffect(() => {
    if (phase !== "spinning") return;
    const t = setTimeout(() => {
      if (phaseRef.current === "spinning" && resultRef.current !== null) {
        handleStop();
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [phase, handleStop]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      isActiveRef.current = false;
    };
  }, []);

  const canStop = phase === "spinning" && latchedResult !== null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="roulette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="roulette-popup"
            initial={{ scale: 0.7, opacity: 0, y: -40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="roulette-wheel-wrap">
              <svg viewBox="0 0 200 220" className="roulette-wheel-svg">
                <defs>
                  <filter id="wshadow">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.3" />
                  </filter>
                  <radialGradient id="cgrad">
                    <stop offset="0%" stopColor="#666" />
                    <stop offset="100%" stopColor="#333" />
                  </radialGradient>
                </defs>

                <circle cx={CX} cy={CY} r={R + 12} fill="#2a2a2a" filter="url(#wshadow)" />
                <circle cx={CX} cy={CY} r={R + 10} fill="#3a3a3a" />

                {pegs.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ddd" stroke="#999" strokeWidth="0.5" />
                ))}

                <g ref={wheelRef}>
                  {segments.map((seg) => (
                    <path key={seg.number} d={seg.path} fill={seg.color} stroke="#fff" strokeWidth="1.2" />
                  ))}
                  {segments.map((seg) => (
                    <text
                      key={`n${seg.number}`}
                      x={seg.lx}
                      y={seg.ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth="2.5"
                      paintOrder="stroke"
                      fontSize="18"
                      fontWeight="900"
                      fontFamily="system-ui, sans-serif"
                      transform={`rotate(${seg.labelAngle} ${seg.lx} ${seg.ly})`}
                    >
                      {seg.number}
                    </text>
                  ))}
                  <circle cx={CX} cy={CY} r="16" fill="url(#cgrad)" stroke="#555" strokeWidth="2" />
                  <circle cx={CX} cy={CY} r="6" fill="#888" />
                </g>

                <polygon
                  points={`${CX},${CY - R + 8} ${CX - 11},${CY - R - 16} ${CX + 11},${CY - R - 16}`}
                  fill="#e60012"
                  stroke="#fff"
                  strokeWidth="2"
                  filter="url(#wshadow)"
                />
                <circle cx={CX} cy={CY - R - 6} r="3" fill="#fff" />
              </svg>

              <AnimatePresence>
                {showResult !== null && (
                  <motion.div
                    className="roulette-result-badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  >
                    {showResult}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="roulette-action">
              {phase === "spinning" ? (
                <motion.button
                  className="btn-green btn-roulette"
                  onClick={handleStop}
                  disabled={!canStop}
                  whileHover={canStop ? { scale: 1.05, y: -2 } : {}}
                  whileTap={canStop ? { scale: 0.92, y: 2 } : {}}
                >
                  {canStop ? "止める！" : "..."}
                </motion.button>
              ) : phase === "result" ? (
                <motion.div
                  className="roulette-result-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {showResult} マス進む！
                </motion.div>
              ) : (
                <motion.button
                  className="btn-blue btn-roulette"
                  onClick={handleSpin}
                  disabled={phase !== "idle"}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.92, y: 2 }}
                >
                  ルーレットを回す
                </motion.button>
              )}

              {phase === "stopping" && (
                <div className="roulette-suspense">ドキドキ...</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
