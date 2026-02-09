import type { MapData, PlayerState } from "../types/protocol";

interface BoardProps {
  board: MapData;
  players: PlayerState[];
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

export default function Board({ board, players }: BoardProps) {
  const maxX = Math.max(...board.tiles.map((t) => t.position.x), 0);
  const maxY = Math.max(...board.tiles.map((t) => t.position.y), 0);
  const svgW = (maxX + 1) * (TILE_SIZE + TILE_GAP) + TILE_GAP;
  const svgH = (maxY + 1) * (TILE_SIZE + TILE_GAP) + TILE_GAP;

  const tilePos = (x: number, y: number) => ({
    cx: TILE_GAP + x * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
    cy: TILE_GAP + y * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2,
  });

  return (
    <div className="board-container">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* Edges */}
        {board.tiles.map((tile) =>
          tile.next.map((nextId) => {
            const nextTile = board.tiles.find((t) => t.id === nextId);
            if (!nextTile) return null;
            const from = tilePos(tile.position.x, tile.position.y);
            const to = tilePos(nextTile.position.x, nextTile.position.y);
            return (
              <line
                key={`${tile.id}-${nextId}`}
                x1={from.cx}
                y1={from.cy}
                x2={to.cx}
                y2={to.cy}
                stroke="#999"
                strokeWidth={2}
              />
            );
          }),
        )}

        {/* Tiles */}
        {board.tiles.map((tile) => {
          const { cx, cy } = tilePos(tile.position.x, tile.position.y);
          return (
            <g key={tile.id}>
              <rect
                x={cx - TILE_SIZE / 2}
                y={cy - TILE_SIZE / 2}
                width={TILE_SIZE}
                height={TILE_SIZE}
                rx={6}
                fill={COLORS[tile.type] ?? "#ccc"}
                stroke="#333"
                strokeWidth={1}
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
            </g>
          );
        })}

        {/* Players */}
        {players.map((player, idx) => {
          const tile = board.tiles.find((t) => t.id === player.position);
          if (!tile) return null;
          const { cx, cy } = tilePos(tile.position.x, tile.position.y);
          const offsetX = (idx % 3) * 14 - 14;
          const offsetY = idx < 3 ? -20 : 24;
          return (
            <circle
              key={player.id}
              cx={cx + offsetX}
              cy={cy + offsetY}
              r={8}
              fill={PLAYER_COLORS[idx % PLAYER_COLORS.length]}
              stroke="#fff"
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );
}
