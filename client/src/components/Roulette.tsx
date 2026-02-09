import { motion, AnimatePresence, useAnimate } from "motion/react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";

interface RouletteProps {
  spinning: boolean;
  result: number | null;
  onSpin: () => void;
  disabled: boolean;
}

/** Particle colors for the reveal burst */
const PARTICLE_COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff922b", "#cc5de8"];

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
  delay: number;
}

export default function Roulette({
  spinning,
  result,
  onSpin,
  disabled,
}: RouletteProps) {
  const [display, setDisplay] = useState<number>(1);
  const [showParticles, setShowParticles] = useState(false);
  const [phase, setPhase] = useState<"idle" | "windup" | "cycling" | "reveal">("idle");
  const frameRef = useRef(0);
  const prevSpinningRef = useRef(false);

  const [displayScope, animateDisplay] = useAnimate<HTMLDivElement>();

  // Generate particle burst positions
  const particles = useMemo<Particle[]>(() => {
    const count = 4 + Math.floor(Math.random() * 3); // 4-6 particles
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (360 / count) * i + (Math.random() * 30 - 15),
      distance: 60 + Math.random() * 40,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 6 + Math.random() * 6,
      delay: Math.random() * 0.08,
    }));
  }, [showParticles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wind-up animation when spinning starts
  const startWindup = useCallback(async () => {
    if (!displayScope.current) return;
    setPhase("windup");
    await animateDisplay(
      displayScope.current,
      { scale: 0.9, rotate: -10 },
      { duration: 0.3, ease: "easeOut" },
    );
    setPhase("cycling");
  }, [animateDisplay, displayScope]);

  // Reveal animation when result arrives
  const startReveal = useCallback(async () => {
    if (!displayScope.current) return;
    setPhase("reveal");
    setShowParticles(true);

    // Spring out to 1.3 then settle to 1.0
    await animateDisplay(
      displayScope.current,
      { scale: 1.3, rotate: 0 },
      { type: "spring", stiffness: 500, damping: 15, duration: 0.3 },
    );
    await animateDisplay(
      displayScope.current,
      { scale: 1.0 },
      { type: "spring", stiffness: 300, damping: 20, duration: 0.4 },
    );

    // Clean up particles after animation
    setTimeout(() => setShowParticles(false), 600);
    setPhase("idle");
  }, [animateDisplay, displayScope]);

  // Handle spinning state changes
  useEffect(() => {
    const wasSpinning = prevSpinningRef.current;
    prevSpinningRef.current = spinning;

    if (spinning && !wasSpinning) {
      // Spinning just started: wind-up then cycle
      startWindup();
    }

    if (!spinning && wasSpinning && result !== null) {
      // Spinning just stopped with a result: reveal
      setDisplay(result);
      startReveal();
    }
  }, [spinning, result, startWindup, startReveal]);

  // Rapid number cycling during spin
  useEffect(() => {
    if (!spinning) {
      if (result !== null) setDisplay(result);
      return;
    }

    frameRef.current = 0;
    const interval = setInterval(() => {
      setDisplay((frameRef.current % 10) + 1);
      frameRef.current++;
    }, 40);

    return () => clearInterval(interval);
  }, [spinning, result]);

  // Oscillate rotation during cycling phase
  useEffect(() => {
    if (phase !== "cycling" || !displayScope.current) return;

    let cancelled = false;

    const oscillate = async () => {
      while (!cancelled && displayScope.current) {
        await animateDisplay(
          displayScope.current,
          { rotate: 8 },
          { duration: 0.1, ease: "easeInOut" },
        );
        if (cancelled) break;
        await animateDisplay(
          displayScope.current,
          { rotate: -8 },
          { duration: 0.1, ease: "easeInOut" },
        );
      }
    };

    oscillate();
    return () => { cancelled = true; };
  }, [phase, animateDisplay, displayScope]);

  return (
    <div className="roulette">
      {/* Wrapper for roulette-display + particles */}
      <div style={{ position: "relative" }}>
        <motion.div
          ref={displayScope}
          className={`roulette-display ${spinning ? "spinning" : ""}`}
          style={{ position: "relative", overflow: "hidden" }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={display}
              initial={{ y: 20, opacity: 0, scale: 0.5 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.06, ease: "easeOut" }}
              style={{
                display: "inline-block",
                lineHeight: 1,
              }}
            >
              {display}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {/* Particle burst container */}
        <AnimatePresence>
          {showParticles && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 0,
                height: 0,
                pointerEvents: "none",
              }}
            >
              {particles.map((p) => {
                const rad = (p.angle * Math.PI) / 180;
                const tx = Math.cos(rad) * p.distance;
                const ty = Math.sin(rad) * p.distance;
                return (
                  <motion.div
                    key={p.id}
                    initial={{
                      x: 0,
                      y: 0,
                      scale: 1,
                      opacity: 1,
                    }}
                    animate={{
                      x: tx,
                      y: ty,
                      scale: 0,
                      opacity: 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: p.delay,
                      ease: "easeOut",
                    }}
                    style={{
                      position: "absolute",
                      width: p.size,
                      height: p.size,
                      borderRadius: "50%",
                      backgroundColor: p.color,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <motion.button
          className="btn-blue"
          onClick={onSpin}
          disabled={disabled || spinning}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.92, y: 2 }}
        >
          {spinning ? "回転中..." : "ルーレットを回す"}
        </motion.button>

        <div className="roulette-label">
          {disabled && !spinning ? (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              他のプレイヤーの番です
            </motion.span>
          ) : (
            ""
          )}
        </div>
      </div>
    </div>
  );
}
