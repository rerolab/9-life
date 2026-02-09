import { useEffect, useState } from "react";

interface RouletteProps {
  spinning: boolean;
  result: number | null;
  onSpin: () => void;
  disabled: boolean;
}

export default function Roulette({
  spinning,
  result,
  onSpin,
  disabled,
}: RouletteProps) {
  const [display, setDisplay] = useState<number>(1);

  useEffect(() => {
    if (!spinning) {
      if (result !== null) setDisplay(result);
      return;
    }
    let frame = 0;
    const interval = setInterval(() => {
      setDisplay((frame % 10) + 1);
      frame++;
    }, 60);
    return () => clearInterval(interval);
  }, [spinning, result]);

  return (
    <div className="roulette">
      <div className={`roulette-display ${spinning ? "spinning" : ""}`}>
        {display}
      </div>
      <div>
        <button className="btn-blue" onClick={onSpin} disabled={disabled || spinning}>
          {spinning ? "回転中..." : "ルーレットを回す"}
        </button>
        <div className="roulette-label">
          {disabled && !spinning ? "他のプレイヤーの番です" : ""}
        </div>
      </div>
    </div>
  );
}
