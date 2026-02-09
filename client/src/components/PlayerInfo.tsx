import type { PlayerState } from "../types/protocol";

interface PlayerInfoProps {
  player: PlayerState;
  isCurrent: boolean;
}

export default function PlayerInfo({ player, isCurrent }: PlayerInfoProps) {
  return (
    <div className={`player-info ${isCurrent ? "current" : ""}`}>
      <h3>{player.name}{isCurrent ? " (手番)" : ""}</h3>
      <table>
        <tbody>
          <tr><td>所持金</td><td>${player.money.toLocaleString()}</td></tr>
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
    </div>
  );
}
