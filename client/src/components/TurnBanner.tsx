import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TurnBannerProps {
  currentPlayerId: string | null;
  myPlayerId: string | null;
  playerName: string | null;
  turnChangeSignal: number;
}

const ROULETTE_WAIT = 2500;
const DISPLAY_DURATION = 2000;

export default function TurnBanner({
  currentPlayerId,
  myPlayerId,
  playerName,
  turnChangeSignal,
}: TurnBannerProps) {
  const [visible, setVisible] = useState(false);
  const isFirstRef = useRef(true);

  const isMyTurn = currentPlayerId === myPlayerId;
  const text = isMyTurn ? "あなたの番！" : `${playerName ?? "???"}の番`;

  useEffect(() => {
    if (turnChangeSignal === 0) return;

    // No delay for the very first turn (game start)
    const delay = isFirstRef.current ? 0 : ROULETTE_WAIT;
    isFirstRef.current = false;

    const showTimer = setTimeout(() => {
      setVisible(true);
    }, delay);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, delay + DISPLAY_DURATION);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [turnChangeSignal]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={turnChangeSignal}
          className="turn-banner-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={`turn-banner ${isMyTurn ? "my-turn" : "other-turn"}`}
            initial={{ x: "-110%", scale: 0.8 }}
            animate={{ x: "0%", scale: 1 }}
            exit={{ x: "110%", scale: 0.8, opacity: 0 }}
            transition={{
              x: { type: "spring", stiffness: 150, damping: 20 },
              scale: { type: "spring", stiffness: 200, damping: 18 },
            }}
          >
            <span className="turn-banner-emoji">
              {isMyTurn ? "\u{1F3B2}" : "\u23F3"}
            </span>
            <span className="turn-banner-text">{text}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
