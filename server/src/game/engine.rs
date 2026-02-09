use crate::protocol::PlayerId;

use super::events::{ClassicEventResolver, StandardRoulette};
use super::state::*;
use super::traits::*;

/// 本家準拠のゲームエンジン実装
pub struct ClassicGameEngine {
    event_resolver: Box<dyn EventResolver>,
    roulette: Box<dyn Roulette>,
}

impl ClassicGameEngine {
    pub fn new() -> Self {
        Self {
            event_resolver: Box::new(ClassicEventResolver),
            roulette: Box::new(StandardRoulette),
        }
    }

    pub fn with_components(
        event_resolver: Box<dyn EventResolver>,
        roulette: Box<dyn Roulette>,
    ) -> Self {
        Self {
            event_resolver,
            roulette,
        }
    }
}

impl Default for ClassicGameEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl GameEngine for ClassicGameEngine {
    fn init(&self, players: Vec<(PlayerId, String)>, map: &MapData) -> GameState {
        let board = Board::from_map(map);

        // Start tile position (tile id 0 by convention)
        let start_pos = board.tiles.first().map(|t| t.id).unwrap_or(0);

        let player_states: Vec<PlayerState> = players
            .into_iter()
            .map(|(id, name)| {
                let mut ps = PlayerState::new(id, name, map.start_money);
                ps.position = start_pos;
                ps
            })
            .collect();

        // Generate initial seed from a simple source
        let seed = 42u64; // deterministic seed for reproducibility

        GameState {
            players: player_states,
            board,
            current_turn: 0,
            phase: TurnPhase::WaitingForSpin,
            rng_seed: seed,
            loan_unit: map.loan_unit,
            loan_interest_rate: map.loan_interest_rate,
            careers: map.careers.clone(),
            houses_for_sale: map.houses.clone(),
        }
    }

    fn spin(&self, state: &GameState) -> (GameState, SpinResult) {
        let value = self.roulette.spin(state);
        let mut new_state = state.clone();
        // Advance the rng so next spin is different
        new_state.next_random();
        new_state.phase = TurnPhase::Moving;

        let player_id = new_state.players[new_state.current_turn].id.clone();
        let result = SpinResult { player_id, value };

        (new_state, result)
    }

    fn advance(&self, state: &GameState, steps: u32) -> (GameState, Vec<GameEvent>) {
        let mut new_state = state.clone();
        let mut events = Vec::new();
        let player_idx = new_state.current_turn;
        let mut remaining = steps;

        while remaining > 0 {
            let current_pos = new_state.players[player_idx].position;
            let tile = new_state.board.tile(current_pos).cloned();

            if let Some(tile) = tile {
                if tile.next.is_empty() {
                    // Reached the end (Retire tile)
                    break;
                }

                // If this tile is a branch and we're not on the last step,
                // just take the first path. Branch choice only applies at final stop.
                let next_tile_id = tile.next[0];
                new_state.players[player_idx].position = next_tile_id;
                remaining -= 1;

                // If passing through a Payday tile (not the final stop), collect salary
                if remaining > 0 {
                    if let Some(pass_tile) = new_state.board.tile(next_tile_id).cloned() {
                        if pass_tile.tile_type == TileType::Payday {
                            new_state = self.event_resolver.resolve_payday(&new_state, player_idx);
                            let pid = new_state.players[player_idx].id.clone();
                            let salary = new_state.players[player_idx].salary as i64;
                            events.push(GameEvent::MoneyChanged {
                                player_id: pid,
                                amount: salary,
                                reason: "給料日(通過)".to_string(),
                            });
                        }
                    }
                }
            } else {
                break;
            }
        }

        // Resolve event at the tile where the player stopped
        let final_pos = new_state.players[player_idx].position;
        if let Some(tile) = new_state.board.tile(final_pos).cloned() {
            let (resolved_state, tile_events) = self.event_resolver.resolve_tile(&new_state, &tile);
            new_state = resolved_state;
            events.extend(tile_events);
        }

        // If phase hasn't been changed by the event (e.g. ChoiceRequired), mark as ResolvingEvent -> TurnEnd
        if new_state.phase == TurnPhase::Moving {
            new_state.phase = TurnPhase::TurnEnd;
        }

        (new_state, events)
    }

    fn choose_path(&self, state: &GameState, path_index: usize) -> GameState {
        let mut new_state = state.clone();
        let player_idx = new_state.current_turn;
        let current_pos = new_state.players[player_idx].position;

        if let Some(tile) = new_state.board.tile(current_pos).cloned() {
            if path_index < tile.next.len() {
                new_state.players[player_idx].position = tile.next[path_index];
            }
        }

        new_state.phase = TurnPhase::TurnEnd;
        new_state
    }

    fn resolve_action(&self, state: &GameState, action: PlayerAction) -> (GameState, Vec<GameEvent>) {
        let mut new_state = state.clone();
        let mut events = Vec::new();
        let player_idx = new_state.current_turn;
        let player_id = new_state.players[player_idx].id.clone();

        match action {
            PlayerAction::BuyHouse { house_id } => {
                if let Some(house) = new_state.houses_for_sale.iter().find(|h| h.id == house_id).cloned() {
                    if new_state.players[player_idx].money >= house.price {
                        new_state.players[player_idx].money -= house.price;
                        events.push(GameEvent::MoneyChanged {
                            player_id: player_id.clone(),
                            amount: -house.price,
                            reason: format!("{}購入", house.name),
                        });
                        events.push(GameEvent::HousePurchased {
                            player_id,
                            house: house.clone(),
                        });
                        new_state.players[player_idx].houses.push(house);
                    }
                }
                new_state.phase = TurnPhase::TurnEnd;
            }

            PlayerAction::BuyInsurance { insurance_type } => {
                match insurance_type {
                    InsuranceType::Life => {
                        new_state.players[player_idx].life_insurance = true;
                        events.push(GameEvent::InsurancePurchased {
                            player_id,
                            insurance_type: InsuranceType::Life,
                        });
                    }
                    InsuranceType::Auto => {
                        new_state.players[player_idx].auto_insurance = true;
                        events.push(GameEvent::InsurancePurchased {
                            player_id,
                            insurance_type: InsuranceType::Auto,
                        });
                    }
                }
                new_state.phase = TurnPhase::TurnEnd;
            }

            PlayerAction::SkipAction => {
                new_state.phase = TurnPhase::TurnEnd;
            }

            PlayerAction::SelectLawsuitTarget { target_id } => {
                let (lawsuit_state, lawsuit_events) =
                    self.event_resolver.resolve_lawsuit(&new_state, &target_id);
                new_state = lawsuit_state;
                events.extend(lawsuit_events);
                new_state.phase = TurnPhase::TurnEnd;
            }

            PlayerAction::RepayDebt => {
                let loan_unit = new_state.loan_unit;
                let repay = (loan_unit as f64 * new_state.loan_interest_rate) as i64;
                if new_state.players[player_idx].debt >= loan_unit
                    && new_state.players[player_idx].money >= repay
                {
                    new_state.players[player_idx].money -= repay;
                    new_state.players[player_idx].debt -= loan_unit;
                    events.push(GameEvent::MoneyChanged {
                        player_id,
                        amount: -repay,
                        reason: "借金返済".to_string(),
                    });
                }
                new_state.phase = TurnPhase::TurnEnd;
            }

            PlayerAction::BuyStock => {
                let cost = 10_000i64;
                if new_state.players[player_idx].money >= cost {
                    new_state.players[player_idx].money -= cost;
                    let stock_id = format!("stock_{}", new_state.next_random() % 100);
                    new_state.players[player_idx].stocks.push(Stock {
                        id: stock_id,
                        name: "株券".to_string(),
                    });
                    events.push(GameEvent::StockPurchased { player_id });
                }
                new_state.phase = TurnPhase::TurnEnd;
            }
        }

        (new_state, events)
    }

    fn end_turn(&self, state: &GameState) -> GameState {
        let mut new_state = state.clone();
        let player_count = new_state.players.len();

        // Find next non-retired player
        let mut next = (new_state.current_turn + 1) % player_count;
        let start = next;
        loop {
            if !new_state.players[next].retired {
                break;
            }
            next = (next + 1) % player_count;
            if next == start {
                // All players retired — should not normally happen if is_finished is checked first
                break;
            }
        }

        new_state.current_turn = next;
        new_state.phase = TurnPhase::WaitingForSpin;
        new_state
    }

    fn is_finished(&self, state: &GameState) -> bool {
        state.players.iter().all(|p| p.retired)
    }

    fn rankings(&self, state: &GameState) -> Vec<Ranking> {
        let mut ranked: Vec<_> = state
            .players
            .iter()
            .map(|p| {
                let total_assets = p.total_assets(state.loan_interest_rate);
                (p.id.clone(), p.name.clone(), total_assets)
            })
            .collect();

        // Sort by total_assets descending
        ranked.sort_by(|a, b| b.2.cmp(&a.2));

        ranked
            .into_iter()
            .enumerate()
            .map(|(i, (player_id, player_name, total_assets))| Ranking {
                player_id,
                player_name,
                total_assets,
                rank: (i + 1) as u32,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_map() -> MapData {
        MapData {
            id: "test".to_string(),
            name: "Test Map".to_string(),
            version: "1.0".to_string(),
            start_money: 10000,
            loan_unit: 20000,
            loan_interest_rate: 1.25,
            tiles: vec![
                TileData {
                    id: 0,
                    tile_type: TileType::Start,
                    position: Position { x: 0.0, y: 0.0 },
                    next: vec![1],
                    event: None,
                    labels: None,
                },
                TileData {
                    id: 1,
                    tile_type: TileType::Payday,
                    position: Position { x: 1.0, y: 0.0 },
                    next: vec![2],
                    event: None,
                    labels: None,
                },
                TileData {
                    id: 2,
                    tile_type: TileType::Retire,
                    position: Position { x: 2.0, y: 0.0 },
                    next: vec![],
                    event: None,
                    labels: None,
                },
            ],
            careers: vec![Career {
                id: "test_career".to_string(),
                name: "Test".to_string(),
                salary: 10000,
                pool: "basic".to_string(),
            }],
            houses: vec![House {
                id: "test_house".to_string(),
                name: "Test House".to_string(),
                price: 50000,
                sell_price: 70000,
            }],
        }
    }

    #[test]
    fn test_init() {
        let engine = ClassicGameEngine::new();
        let map = sample_map();
        let players = vec![
            ("p1".to_string(), "Alice".to_string()),
            ("p2".to_string(), "Bob".to_string()),
        ];
        let state = engine.init(players, &map);

        assert_eq!(state.players.len(), 2);
        assert_eq!(state.players[0].money, 10000);
        assert_eq!(state.players[0].position, 0);
        assert_eq!(state.current_turn, 0);
        assert_eq!(state.phase, TurnPhase::WaitingForSpin);
    }

    #[test]
    fn test_spin() {
        let engine = ClassicGameEngine::new();
        let map = sample_map();
        let players = vec![
            ("p1".to_string(), "Alice".to_string()),
            ("p2".to_string(), "Bob".to_string()),
        ];
        let state = engine.init(players, &map);
        let (new_state, result) = engine.spin(&state);

        assert!(result.value >= 1 && result.value <= 10);
        assert_eq!(result.player_id, "p1");
        assert_eq!(new_state.phase, TurnPhase::Moving);
    }

    #[test]
    fn test_advance_and_retire() {
        let engine = ClassicGameEngine::new();
        let map = sample_map();
        let players = vec![
            ("p1".to_string(), "Alice".to_string()),
            ("p2".to_string(), "Bob".to_string()),
        ];
        let mut state = engine.init(players, &map);
        state.players[0].salary = 10000;

        // Advance 2 steps: Start(0) -> Payday(1) -> Retire(2)
        let (new_state, _events) = engine.advance(&state, 2);
        assert_eq!(new_state.players[0].position, 2);
        assert!(new_state.players[0].retired);
    }

    #[test]
    fn test_end_turn_skips_retired() {
        let engine = ClassicGameEngine::new();
        let map = sample_map();
        let players = vec![
            ("p1".to_string(), "Alice".to_string()),
            ("p2".to_string(), "Bob".to_string()),
            ("p3".to_string(), "Charlie".to_string()),
        ];
        let mut state = engine.init(players, &map);
        state.players[1].retired = true; // Bob is retired

        // Turn 0 (Alice) -> end_turn -> should skip Bob (retired) -> Charlie (turn 2)
        let new_state = engine.end_turn(&state);
        assert_eq!(new_state.current_turn, 2);
    }

    #[test]
    fn test_is_finished() {
        let engine = ClassicGameEngine::new();
        let map = sample_map();
        let players = vec![
            ("p1".to_string(), "Alice".to_string()),
            ("p2".to_string(), "Bob".to_string()),
        ];
        let mut state = engine.init(players, &map);

        assert!(!engine.is_finished(&state));

        state.players[0].retired = true;
        state.players[1].retired = true;
        assert!(engine.is_finished(&state));
    }

    #[test]
    fn test_rankings() {
        let engine = ClassicGameEngine::new();
        let map = sample_map();
        let players = vec![
            ("p1".to_string(), "Alice".to_string()),
            ("p2".to_string(), "Bob".to_string()),
        ];
        let mut state = engine.init(players, &map);
        state.players[0].money = 50000;
        state.players[1].money = 100000;

        let rankings = engine.rankings(&state);
        assert_eq!(rankings[0].player_id, "p2"); // Bob has more money
        assert_eq!(rankings[0].rank, 1);
        assert_eq!(rankings[1].player_id, "p1");
        assert_eq!(rankings[1].rank, 2);
    }
}
