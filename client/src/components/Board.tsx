import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import type { MapData, PlayerState, TileEvent } from "../types/protocol";

interface BoardProps {
  board: MapData;
  players: PlayerState[];
  prevPositions: Record<string, number>;
  currentPlayerId: string | null;
  onMoveComplete?: () => void;
}

const WORLD_W = 2200;
const WORLD_H = 1920;
const DEFAULT_ZOOM = 0.55;
const ROAD_WIDTH = 38;
const TILE_RADIUS = 22;

const PLAYER_COLORS = [
  "#e53935",
  "#1e88e5",
  "#43a047",
  "#fb8c00",
  "#8e24aa",
  "#00acc1",
];

const TILE_COLORS: Record<string, string> = {
  Start: "#4caf50",
  Payday: "#fbc02d",
  Action: "#42a5f5",
  Career: "#ab47bc",
  House: "#ff9800",
  Marry: "#ec407a",
  Baby: "#f48fb1",
  Stock: "#26c6da",
  Insurance: "#78909c",
  Tax: "#ef5350",
  Lawsuit: "#d32f2f",
  Branch: "#66bb6a",
  Retire: "#ffd700",
};

const TILE_EMOJI: Record<string, string> = {
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
  Branch: "\u{1F500}",
  Retire: "\u{1F3C1}",
};

function getTileLabel(tile: { type: string; event?: TileEvent | null }): string {
  if (tile.type === "Action" && tile.event && tile.event.type === "money") {
    return tile.event.text;
  }
  const labels: Record<string, string> = {
    Start: "スタート",
    Retire: "ゴール",
    Payday: "給料日",
    Career: "就職",
    House: "住宅",
    Marry: "結婚",
    Baby: "出産",
    Stock: "株式",
    Insurance: "保険",
    Tax: "税金",
    Lawsuit: "裁判",
    Branch: "分岐",
  };
  return labels[tile.type] ?? "";
}

function getZoneColor(tileId: number): string {
  if (tileId >= 30) return "#fdd835";
  if (tileId >= 22) return "#ff8a65";
  if (tileId >= 15) return "#64b5f6";
  if (tileId >= 9) return "#f48fb1";
  return "#81c784";
}

interface TreeProps {
  x: number;
  y: number;
  scale?: number;
}

function Tree({ x, y, scale = 1 }: TreeProps) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x={-3} y={-2} width={6} height={14} rx={2} fill="#6d4c41" />
      <circle cx={0} cy={-12} r={14} fill="#388e3c" />
      <circle cx={-8} cy={-6} r={10} fill="#43a047" />
      <circle cx={8} cy={-6} r={10} fill="#43a047" />
      <circle cx={0} cy={-16} r={8} fill="#2e7d32" />
    </g>
  );
}

const TREES: TreeProps[] = [
  { x: 80, y: 1350, scale: 1.1 },
  { x: 120, y: 1100, scale: 0.8 },
  { x: 60, y: 850, scale: 1.0 },
  { x: 150, y: 600, scale: 0.9 },
  { x: 100, y: 400, scale: 1.2 },
  { x: 250, y: 250, scale: 0.7 },
  { x: 700, y: 350, scale: 0.9 },
  { x: 950, y: 320, scale: 0.8 },
  { x: 1350, y: 340, scale: 1.0 },
  { x: 1900, y: 130, scale: 0.9 },
  { x: 2080, y: 350, scale: 1.1 },
  { x: 2100, y: 700, scale: 0.8 },
  { x: 2080, y: 1100, scale: 1.0 },
  { x: 2050, y: 1500, scale: 0.9 },
  { x: 1100, y: 1150, scale: 0.7 },
  { x: 500, y: 1200, scale: 0.8 },
  { x: 200, y: 1850, scale: 1.0 },
  { x: 600, y: 1850, scale: 0.9 },
  { x: 1300, y: 1800, scale: 0.8 },
  { x: 1700, y: 1750, scale: 1.0 },
  { x: 1100, y: 680, scale: 0.6 },
  { x: 750, y: 680, scale: 0.7 },
  { x: 300, y: 1050, scale: 0.9 },
];

export default function Board({
  board,
  players,
  prevPositions: _prevPositions,
  currentPlayerId,
  onMoveComplete,
}: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const currentTileId = currentPlayer?.position ?? null;

  // Auto-scroll to current player
  useEffect(() => {
    if (!containerRef.current || currentTileId === null) return;
    const tile = board.tiles.find((t) => t.id === currentTileId);
    if (!tile) return;
    const el = containerRef.current;
    const scrollX = tile.position.x * zoom - el.clientWidth / 2;
    const scrollY = tile.position.y * zoom - el.clientHeight / 2;
    el.scrollTo({ left: scrollX, top: scrollY, behavior: "smooth" });
  }, [currentPlayerId, currentTileId, board.tiles, zoom]);

  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(1.5, z + 0.1)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(0.3, z - 0.1)),
    [],
  );
  const handleZoomReset = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    if (!containerRef.current || currentTileId === null) return;
    const tile = board.tiles.find((t) => t.id === currentTileId);
    if (!tile) return;
    const el = containerRef.current;
    setTimeout(() => {
      el.scrollTo({
        left: tile.position.x * DEFAULT_ZOOM - el.clientWidth / 2,
        top: tile.position.y * DEFAULT_ZOOM - el.clientHeight / 2,
        behavior: "smooth",
      });
    }, 50);
  }, [board.tiles, currentTileId]);

  // Get car heading angle
  const getCarAngle = useCallback(
    (tileId: number): number => {
      const tile = board.tiles.find((t) => t.id === tileId);
      if (!tile) return 0;
      if (tile.next.length > 0) {
        const nextTile = board.tiles.find((t) => t.id === tile.next[0]);
        if (nextTile) {
          return (
            Math.atan2(
              nextTile.position.y - tile.position.y,
              nextTile.position.x - tile.position.x,
            ) *
            (180 / Math.PI)
          );
        }
      }
      const prevTile = board.tiles.find((t) => t.next.includes(tileId));
      if (prevTile) {
        return (
          Math.atan2(
            tile.position.y - prevTile.position.y,
            tile.position.x - prevTile.position.x,
          ) *
          (180 / Math.PI)
        );
      }
      return 0;
    },
    [board.tiles],
  );

  // Build edges list
  const edges: { fromX: number; fromY: number; toX: number; toY: number; fromId: number }[] = [];
  for (const tile of board.tiles) {
    for (const nextId of tile.next) {
      const nextTile = board.tiles.find((t) => t.id === nextId);
      if (nextTile) {
        edges.push({
          fromX: tile.position.x,
          fromY: tile.position.y,
          toX: nextTile.position.x,
          toY: nextTile.position.y,
          fromId: tile.id,
        });
      }
    }
  }

  const svgW = WORLD_W * zoom;
  const svgH = WORLD_H * zoom;

  return (
    <div className="board-container" ref={containerRef}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        style={{ display: "block" }}
      >
        {/* Background grass field */}
        <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="#4a8f2e" />
        <rect x={0} y={0} width={WORLD_W} height={WORLD_H} fill="url(#grassPattern)" />

        <defs>
          <pattern
            id="grassPattern"
            width={40}
            height={40}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={10} cy={10} r={0.8} fill="rgba(255,255,255,0.04)" />
            <circle cx={30} cy={25} r={0.6} fill="rgba(255,255,255,0.03)" />
            <circle cx={20} cy={35} r={0.5} fill="rgba(0,0,0,0.03)" />
          </pattern>

          {/* Road shadow filter */}
          <filter id="roadShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx={0} dy={3} stdDeviation={4} floodOpacity={0.25} />
          </filter>

          {/* Tile glow filter */}
          <filter id="tileGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={4} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Decorative pond */}
        <ellipse cx={180} cy={720} rx={80} ry={50} fill="#1976d2" opacity={0.4} />
        <ellipse cx={180} cy={720} rx={65} ry={38} fill="#42a5f5" opacity={0.5} />
        <ellipse cx={170} cy={715} rx={40} ry={22} fill="#64b5f6" opacity={0.4} />

        {/* Trees */}
        {TREES.map((tree, i) => (
          <Tree key={`tree-${i}`} {...tree} />
        ))}

        {/* Road zone borders (colored road edges) */}
        {edges.map((e, i) => (
          <line
            key={`zone-${i}`}
            x1={e.fromX}
            y1={e.fromY}
            x2={e.toX}
            y2={e.toY}
            stroke={getZoneColor(e.fromId)}
            strokeWidth={ROAD_WIDTH + 10}
            strokeLinecap="round"
            opacity={0.7}
          />
        ))}

        {/* Road shadow */}
        {edges.map((e, i) => (
          <line
            key={`shadow-${i}`}
            x1={e.fromX}
            y1={e.fromY + 4}
            x2={e.toX}
            y2={e.toY + 4}
            stroke="rgba(0,0,0,0.18)"
            strokeWidth={ROAD_WIDTH + 2}
            strokeLinecap="round"
          />
        ))}

        {/* Road surface */}
        {edges.map((e, i) => (
          <line
            key={`road-${i}`}
            x1={e.fromX}
            y1={e.fromY}
            x2={e.toX}
            y2={e.toY}
            stroke="#6d6d6d"
            strokeWidth={ROAD_WIDTH}
            strokeLinecap="round"
          />
        ))}

        {/* Road center dashed line */}
        {edges.map((e, i) => (
          <line
            key={`center-${i}`}
            x1={e.fromX}
            y1={e.fromY}
            x2={e.toX}
            y2={e.toY}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={2}
            strokeDasharray="14 12"
            strokeLinecap="round"
          />
        ))}

        {/* Branch labels */}
        {board.tiles.map((tile) => {
          if (!tile.labels || tile.labels.length < 2) return null;
          return tile.next.map((nextId, idx) => {
            const nextTile = board.tiles.find((t) => t.id === nextId);
            if (!nextTile || !tile.labels) return null;
            const mx = (tile.position.x + nextTile.position.x) / 2;
            const my = (tile.position.y + nextTile.position.y) / 2;
            const label = tile.labels[idx];
            if (!label) return null;
            return (
              <g key={`label-${tile.id}-${nextId}`}>
                <rect
                  x={mx - 45}
                  y={my - 12}
                  width={90}
                  height={24}
                  rx={12}
                  fill="rgba(0,0,0,0.6)"
                />
                <text
                  x={mx}
                  y={my + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight="bold"
                  fill="#fff"
                  fontFamily="'Noto Sans JP', sans-serif"
                >
                  {label}
                </text>
              </g>
            );
          });
        })}

        {/* Tile markers */}
        {board.tiles.map((tile) => {
          const isCurrentTile = tile.id === currentTileId;
          const label = getTileLabel(tile);
          const isSpecial = tile.type === "Start" || tile.type === "Retire";
          const r = isSpecial ? TILE_RADIUS + 6 : TILE_RADIUS;

          return (
            <g key={`tile-${tile.id}`}>
              {/* Current tile glow */}
              {isCurrentTile && (
                <motion.circle
                  cx={tile.position.x}
                  cy={tile.position.y}
                  r={r + 10}
                  fill="none"
                  stroke="#ffd700"
                  strokeWidth={3}
                  animate={{
                    r: [r + 8, r + 14, r + 8],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}

              {/* Shadow */}
              <circle
                cx={tile.position.x}
                cy={tile.position.y + 3}
                r={r}
                fill="rgba(0,0,0,0.2)"
              />

              {/* Main circle */}
              <circle
                cx={tile.position.x}
                cy={tile.position.y}
                r={r}
                fill={TILE_COLORS[tile.type] ?? "#ccc"}
                stroke="#fff"
                strokeWidth={isSpecial ? 3.5 : 2.5}
              />

              {/* Emoji */}
              <text
                x={tile.position.x}
                y={tile.position.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isSpecial ? 18 : 14}
              >
                {TILE_EMOJI[tile.type] ?? "\u2B50"}
              </text>

              {/* Label */}
              {label && (
                <text
                  x={tile.position.x}
                  y={tile.position.y + r + 15}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="bold"
                  fill="#fff"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  fontFamily="'Noto Sans JP', sans-serif"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Player cars */}
        {players.map((player, idx) => {
          const tile = board.tiles.find((t) => t.id === player.position);
          if (!tile) return null;

          // Offset multiple players on the same tile
          const playersHere = players.filter(
            (p) => p.position === player.position,
          );
          const myIdx = playersHere.findIndex((p) => p.id === player.id);
          const total = playersHere.length;
          const angle = ((myIdx / total) * Math.PI * 2) - Math.PI / 2;
          const radius = total > 1 ? 30 : 0;
          const ox = Math.cos(angle) * radius;
          const oy = Math.sin(angle) * radius;

          const carAngle = getCarAngle(player.position);
          const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];

          const targetX = tile.position.x + ox;
          const targetY = tile.position.y + oy;

          return (
            <motion.g
              key={player.id}
              initial={{ x: targetX, y: targetY }}
              animate={{
                x: targetX,
                y: targetY,
              }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 15,
                mass: 0.8,
              }}
              onAnimationComplete={() => {
                if (player.id === currentPlayerId) onMoveComplete?.();
              }}
            >
              <g transform={`rotate(${carAngle})`}>
                {/* Car shadow */}
                <ellipse cx={0} cy={3} rx={14} ry={8} fill="rgba(0,0,0,0.15)" />

                {/* Wheels */}
                <rect
                  x={-10}
                  y={-10}
                  width={6}
                  height={4}
                  rx={1.5}
                  fill="#333"
                />
                <rect
                  x={-10}
                  y={6}
                  width={6}
                  height={4}
                  rx={1.5}
                  fill="#333"
                />
                <rect
                  x={4}
                  y={-10}
                  width={6}
                  height={4}
                  rx={1.5}
                  fill="#333"
                />
                <rect
                  x={4}
                  y={6}
                  width={6}
                  height={4}
                  rx={1.5}
                  fill="#333"
                />

                {/* Car body */}
                <rect
                  x={-13}
                  y={-7}
                  width={26}
                  height={14}
                  rx={5}
                  fill={color}
                  stroke="#222"
                  strokeWidth={0.8}
                />

                {/* Windshield */}
                <rect
                  x={2}
                  y={-5}
                  width={7}
                  height={10}
                  rx={2.5}
                  fill="rgba(200,230,255,0.55)"
                />

                {/* Rear section */}
                <rect
                  x={-11}
                  y={-5}
                  width={6}
                  height={10}
                  rx={2}
                  fill="rgba(0,0,0,0.15)"
                />

                {/* Headlights */}
                <circle cx={12} cy={-3.5} r={1.5} fill="#ffe082" />
                <circle cx={12} cy={3.5} r={1.5} fill="#ffe082" />

                {/* Taillights */}
                <circle cx={-12} cy={-3.5} r={1} fill="#ef5350" />
                <circle cx={-12} cy={3.5} r={1} fill="#ef5350" />
              </g>

              {/* Player name tag */}
              <g>
                <rect
                  x={-24}
                  y={-24}
                  width={48}
                  height={14}
                  rx={7}
                  fill="rgba(0,0,0,0.55)"
                />
                <text
                  x={0}
                  y={-16}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontWeight="bold"
                  fill="#fff"
                  fontFamily="'Noto Sans JP', sans-serif"
                >
                  {player.name.length > 6
                    ? player.name.slice(0, 5) + "…"
                    : player.name}
                </text>
              </g>
            </motion.g>
          );
        })}
      </svg>

      {/* Zoom controls */}
      <div className="board-controls">
        <button onClick={handleZoomIn} title="ズームイン">
          +
        </button>
        <button onClick={handleZoomOut} title="ズームアウト">
          −
        </button>
        <button onClick={handleZoomReset} title="リセット">
          ⌂
        </button>
      </div>
    </div>
  );
}
