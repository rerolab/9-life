import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { PlayerState, Tile } from "../types/protocol";

interface EventToastProps {
  playerStates: PlayerState[];
  prevPositions: Record<string, number>;
  currentPlayerId: string | null;
  tiles: Tile[];
  onDismiss?: () => void;
}

interface ToastData {
  id: number;
  playerName: string;
  text: string;
  amount: number | null;
  emoji: string;
  tileType: string;
}

const TYPE_EMOJI: Record<string, string> = {
  Start: "\u{1F697}",
  Payday: "\u{1F4B0}",
  Action: "\u2B50",
  Career: "\u{1F4BC}",
  House: "\u{1F3E0}",
  Marry: "\u{1F492}",
  Baby: "\u{1F476}",
  Stock: "\u{1F4C8}",
  Insurance: "\u{1F6E1}",
  Tax: "\u{1F4CB}",
  Lawsuit: "\u2696",
  Retire: "\u{1F3C1}",
};

function getEventDescription(tile: Tile, player: PlayerState): ToastData | null {
  const base = {
    id: Date.now(),
    playerName: player.name,
    emoji: TYPE_EMOJI[tile.type] ?? "\u2B50",
    tileType: tile.type,
  };

  switch (tile.type) {
    case "Action":
      if (tile.event && tile.event.type === "money") {
        return { ...base, text: tile.event.text, amount: tile.event.amount };
      }
      return null;

    case "Payday":
      return {
        ...base,
        text: "\u{1F4B0} \u7D66\u6599\u65E5\uFF01\u304A\u7D66\u6599\u3092\u3082\u3089\u3046",
        amount: player.salary,
      };

    case "Marry":
      return {
        ...base,
        text: "\u{1F492} \u7D50\u5A5A\u304A\u3081\u3067\u3068\u3046\uFF01\u307F\u3093\u306A\u304B\u3089\u3054\u795D\u5100\u3092\u3082\u3089\u3046",
        amount: null,
      };

    case "Baby":
      return {
        ...base,
        text: "\u{1F476} \u8D64\u3061\u3083\u3093\u304C\u8A95\u751F\uFF01\u304A\u3081\u3067\u3068\u3046\uFF01",
        amount: null,
      };

    case "Career":
      return {
        ...base,
        text: "\u{1F4BC} \u65B0\u3057\u3044\u4ED5\u4E8B\u306B\u5C31\u304D\u307E\u3057\u305F\uFF01",
        amount: null,
      };

    case "Tax":
      return {
        ...base,
        text: "\u{1F4CB} \u7A0E\u52D9\u7F72\u304B\u3089\u901A\u77E5\uFF01\u7A0E\u91D1\u3092\u652F\u6255\u3046",
        amount: null,
      };

    case "Stock":
      return {
        ...base,
        text: "\u{1F4C8} \u682A\u5F0F\u5E02\u5834\u3067\u682A\u3092\u8CFC\u5165\uFF01",
        amount: -10000,
      };

    case "Retire":
      return {
        ...base,
        text: "\u{1F3C1} \u304A\u75B2\u308C\u69D8\u3067\u3057\u305F\uFF01\u4EBA\u751F\u306E\u30B4\u30FC\u30EB\u306B\u5230\u9054\uFF01",
        amount: null,
      };

    default:
      return null;
  }
}

export default function EventToast({
  playerStates,
  prevPositions,
  currentPlayerId,
  tiles,
  onDismiss,
}: EventToastProps) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!currentPlayerId) return;
    const ps = playerStates.find((p) => p.id === currentPlayerId);
    if (!ps) return;
    const prevPos = prevPositions[currentPlayerId];
    if (prevPos === undefined || ps.position === prevPos) return;

    const tile = tiles.find((t) => t.id === ps.position);
    if (!tile) return;

    const data = getEventDescription(tile, ps);
    if (!data) return;

    // Don't show toast for tiles that will show a dialog (House, Insurance, Lawsuit)
    if (
      tile.type === "House" ||
      tile.type === "Insurance" ||
      tile.type === "Lawsuit"
    )
      return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(data);
    timerRef.current = setTimeout(() => {
      setToast(null);
      onDismiss?.();
    }, 3500);
  }, [playerStates, prevPositions, currentPlayerId, tiles]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className="event-toast"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="event-toast-emoji">{toast.emoji}</div>
          <div className="event-toast-body">
            <div className="event-toast-player">{toast.playerName}</div>
            <div className="event-toast-text">{toast.text}</div>
            {toast.amount !== null && (
              <div
                className={`event-toast-amount ${toast.amount >= 0 ? "positive" : "negative"}`}
              >
                {toast.amount >= 0 ? "+" : ""}${Math.abs(toast.amount).toLocaleString()}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
