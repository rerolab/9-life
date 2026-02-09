import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import type { MapData, PlayerState } from "../types/protocol";

interface BoardProps {
  board: MapData;
  players: PlayerState[];
  prevPositions: Record<string, number>;
  currentPlayerId: string | null;
}

const TILE_SIZE = 60;
const TILE_GAP = 10;
const COLORS: Record<string, string> = {
  Start: "#4caf50",
  Payday: "#ffeb3b",
  Action: "#2196f3",
  Career: "#9c27b0",
  House: "#ff9800",
  Marry: "#e91e63",
  Baby: "#f48fb1",
  Stock: "#00bcd4",
  Insurance: "#607d8b",
  Tax: "#f44336",
  Lawsuit: "#b71c1c",
  Branch: "#8bc34a",
  Retire: "#ffd700",
};

const PLAYER_COLORS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa", "#00acc1"];

export default function Board({ board, players, prevPositions, currentPlayerId }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const maxX = Math.max(...board.tiles.map((t) => t.position.x), 0);
  const maxY = Math.max(...board.tiles.map((t) => t.position.y), 0);
  const svgW = (maxX + 1) * (TILE_SIZE + TILE_GAP) + TILE_GAP;
  const svgH = (maxY + 1) * (TILE_SIZE + TILE_GAP) + TILE_GAP;

  const tilePos = (x: number, y: number) => ({
    cx: TILE_GAP + x * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
    cy: TILE_GAP + y * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
  });

  // 現在のプレイヤーが乗っているタイルIDを取得
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const currentTileId = currentPlayer?.position ?? null;

  // 自動スクロール: 現在プレイヤーのタイル位置にスムーズスクロール
  useEffect(() => {
    if (!containerRef.current || currentTileId === null) return;
    const tile = board.tiles.find((t) => t.id === currentTileId);
    if (!tile) return;
    const { cx, cy } = tilePos(tile.position.x, tile.position.y);
    const container = containerRef.current;
    const scrollX = cx - container.clientWidth / 2;
    const scrollY = cy - container.clientHeight / 2;
    container.scrollTo({ left: scrollX, top: scrollY, behavior: "smooth" });
  }, [currentPlayerId, currentTileId, board.tiles]);

  return (
    <div className="board-container" ref={containerRef}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ overflow: "visible" }}
      >
        {/* Edges */}
        {board.tiles.map((tile) =>
          tile.next.map((nextId) => {
            const nextTile = board.tiles.find((t) => t.id === nextId);
            if (!nextTile) return null;
            const from = tilePos(tile.position.x, tile.position.y);
            const to = tilePos(nextTile.position.x, nextTile.position.y);
            return (
              <motion.path
                key={`${tile.id}-${nextId}`}
                d={`M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`}
                stroke="#b0bec5"
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: tile.id * 0.02, ease: "easeOut" }}
              />
            );
          }),
        )}

        {/* Tiles */}
        {board.tiles.map((tile) => {
          const { cx, cy } = tilePos(tile.position.x, tile.position.y);
          const isCurrentTile = tile.id === currentTileId;
          return (
            <motion.g
              key={tile.id}
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              style={{ originX: `${cx}px`, originY: `${cy}px` }}
            >
              <motion.rect
                x={cx - TILE_SIZE / 2}
                y={cy - TILE_SIZE / 2}
                width={TILE_SIZE}
                height={TILE_SIZE}
                rx={8}
                fill={COLORS[tile.type] ?? "#ccc"}
                stroke={isCurrentTile ? "#FFD700" : "#333"}
                strokeWidth={isCurrentTile ? 3 : 1}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.4,
                  delay: tile.id * 0.03,
                  ease: "easeOut",
                }}
              />
              <text
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                fontSize={10}
                fill="#fff"
              >
                {tile.type}
              </text>
              <text
                x={cx}
                y={cy + 10}
                textAnchor="middle"
                fontSize={9}
                fill="#fff"
              >
                #{tile.id}
              </text>
            </motion.g>
          );
        })}

        {/* Players */}
        {players.map((player, idx) => {
          const tile = board.tiles.find((t) => t.id === player.position);
          if (!tile) return null;
          const { cx, cy } = tilePos(tile.position.x, tile.position.y);
          const offsetX = (idx % 3) * 14 - 14;
          const offsetY = idx < 3 ? -20 : 24;
          const targetX = cx + offsetX;
          const targetY = cy + offsetY;
          const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
          const initial = player.id.charAt(0).toUpperCase();

          return (
            <g key={player.id}>
              <motion.circle
                cx={targetX}
                cy={targetY}
                animate={{ cx: targetX, cy: targetY }}
                transition={{
                  type: "spring",
                  stiffness: 120,
                  damping: 14,
                  mass: 0.8,
                }}
                r={10}
                fill={color}
                stroke="#fff"
                strokeWidth={2.5}
              />
              <motion.text
                x={targetX}
                y={targetY}
                animate={{ x: targetX, y: targetY }}
                transition={{
                  type: "spring",
                  stiffness: 120,
                  damping: 14,
                  mass: 0.8,
                }}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontWeight="bold"
                fill="#fff"
                pointerEvents="none"
              >
                {initial}
              </motion.text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
