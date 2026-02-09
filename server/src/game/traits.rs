use crate::protocol::PlayerId;

use super::state::*;

/// ゲームエンジンのコアトレイト
/// 全メソッドが &GameState を受け取り、新しい GameState を返す（イミュータブル設計）
pub trait GameEngine: Send + Sync {
    /// ゲーム初期状態を生成
    fn init(&self, players: Vec<(PlayerId, String)>, map: &MapData) -> GameState;

    /// ルーレットを回し、結果と新しい状態を返す
    fn spin(&self, state: &GameState) -> (GameState, SpinResult);

    /// プレイヤーを移動させ、停止マスのイベントを返す
    fn advance(&self, state: &GameState, steps: u32) -> (GameState, Vec<GameEvent>);

    /// 分岐マスでの選択を処理
    fn choose_path(&self, state: &GameState, path_index: usize) -> GameState;

    /// イベント選択（家購入、保険加入など）を処理
    fn resolve_action(&self, state: &GameState, action: PlayerAction) -> (GameState, Vec<GameEvent>);

    /// ターン終了処理（次のプレイヤーへ）
    fn end_turn(&self, state: &GameState) -> GameState;

    /// ゲーム終了判定
    fn is_finished(&self, state: &GameState) -> bool;

    /// 最終順位を計算
    fn rankings(&self, state: &GameState) -> Vec<Ranking>;
}

/// イベント処理の拡張トレイト
pub trait EventResolver: Send + Sync {
    /// マスに止まった時のイベントを解決
    fn resolve_tile(&self, state: &GameState, tile: &Tile) -> (GameState, Vec<GameEvent>);

    /// 給料日の処理
    fn resolve_payday(&self, state: &GameState, player_index: usize) -> GameState;

    /// 訴訟の処理
    fn resolve_lawsuit(&self, state: &GameState, target: &PlayerId) -> (GameState, Vec<GameEvent>);
}

/// ルーレット（乱数生成）の抽象化
pub trait Roulette: Send + Sync {
    /// 1〜10 の値を返す
    fn spin(&self, state: &GameState) -> u32;
}
