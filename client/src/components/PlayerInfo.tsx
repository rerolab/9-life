import { motion, AnimatePresence } from "motion/react";
import type { PlayerState } from "../types/protocol";

interface PlayerInfoProps {
  player: PlayerState;
  isCurrent: boolean;
}

export default function PlayerInfo({ player, isCurrent }: PlayerInfoProps) {
  return (
    <motion.div
      className={`player-info ${isCurrent ? "current" : ""}`}
      layout
      animate={{
        borderLeftColor: isCurrent ? "var(--nin-red)" : "transparent",
        x: isCurrent ? 4 : 0,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <h3>
        {player.name}
        <AnimatePresence>
          {isCurrent && (
            <motion.span
              className="turn-badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              手番
            </motion.span>
          )}
        </AnimatePresence>
      </h3>
      <table>
        <tbody>
          <tr>
            <td>所持金</td>
            <motion.td
              key={player.money}
              initial={{ color: "#e60012", scale: 1.1 }}
              animate={{ color: "var(--nin-text)", scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              ${player.money.toLocaleString()}
            </motion.td>
          </tr>
          <tr><td>職業</td><td>{player.career?.name ?? "なし"}</td></tr>
          <tr><td>給料</td><td>${player.salary.toLocaleString()}</td></tr>
          <tr><td>配偶者</td><td>{player.married ? "あり" : "なし"}</td></tr>
          <tr><td>子供</td><td>{player.children}人</td></tr>
          <tr><td>生命保険</td><td>{player.life_insurance ? "加入" : "未加入"}</td></tr>
          <tr><td>自動車保険</td><td>{player.auto_insurance ? "加入" : "未加入"}</td></tr>
          <tr><td>株</td><td>{player.stocks.length > 0 ? player.stocks.join(", ") : "なし"}</td></tr>
          <tr><td>家</td><td>{player.houses.length > 0 ? player.houses.map(h => h.name).join(", ") : "なし"}</td></tr>
          <tr><td>借金</td><td>${player.debt.toLocaleString()}</td></tr>
        </tbody>
      </table>
    </motion.div>
  );
}
