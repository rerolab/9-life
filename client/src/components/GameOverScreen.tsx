import { motion } from "motion/react";
import { useMemo } from "react";
import type { RankingEntry } from "../types/protocol";

interface GameOverScreenProps {
  rankings: RankingEntry[];
}

const CONFETTI_COLORS = [
  "#e60012",
  "#0ab5f5",
  "#f5c518",
  "#4fc436",
  "#ff9800",
  "#8e24aa",
];

function Confetti() {
  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 600 - 300,
      y: -(Math.random() * 400 + 100),
      rotate: Math.random() * 720 - 360,
      scale: Math.random() * 0.6 + 0.4,
      delay: Math.random() * 0.3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    }));
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 101,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: p.color,
          }}
          initial={{ x: 0, y: 0, rotate: 0, scale: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            rotate: p.rotate,
            scale: p.scale,
            opacity: 0,
          }}
          transition={{
            duration: 1.5,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

function GameOverScreen({ rankings }: GameOverScreenProps) {
  const reversed = useMemo(() => [...rankings].reverse(), [rankings]);

  return (
    <div className="event-dialog-overlay">
      <Confetti />
      <div className="event-dialog">
        <motion.h2
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 12,
            delay: 0.2,
          }}
        >
          ゲーム終了!
        </motion.h2>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {reversed.map((entry, index) => (
            <motion.li
              key={entry.player_id}
              initial={{ opacity: 0, x: -30, scale: 0.9 }}
              animate={{
                opacity: 1,
                x: 0,
                scale:
                  entry.rank === 1 ? [0.9, 1.15, 1] : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.5 + index * 0.3,
              }}
            >
              <span className="rank-number">{entry.rank}</span>
              <span className="rank-name">{entry.player_name}</span>
              <motion.span
                className="rank-assets"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  delay: 0.5 + index * 0.3 + 0.15,
                }}
              >
                ${entry.total_assets.toLocaleString()}
              </motion.span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default GameOverScreen;
