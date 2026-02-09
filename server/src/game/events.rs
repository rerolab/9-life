use crate::protocol::PlayerId;

use super::state::*;
use super::traits::{EventResolver, Roulette};

// ============================================================
// StandardRoulette - xorshift64ベースの1-10乱数
// ============================================================

pub struct StandardRoulette;

impl Roulette for StandardRoulette {
    fn spin(&self, state: &GameState) -> u32 {
        // Use seed to derive a value 1-10 without mutating state
        let mut x = state.rng_seed;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        (x % 10 + 1) as u32
    }
}

// ============================================================
// ClassicEventResolver - 本家準拠イベント処理
// ============================================================

pub struct ClassicEventResolver;

impl ClassicEventResolver {
    fn gift_from_others(state: &GameState, recipient_idx: usize, amount: i64, reason: &str) -> (GameState, Vec<GameEvent>) {
        let mut new_state = state.clone();
        let mut events = Vec::new();
        let recipient_id = new_state.players[recipient_idx].id.clone();

        for i in 0..new_state.players.len() {
            if i == recipient_idx || new_state.players[i].retired {
                continue;
            }
            let giver_id = new_state.players[i].id.clone();
            new_state.players[i].money -= amount;
            new_state.players[recipient_idx].money += amount;

            events.push(GameEvent::MoneyChanged {
                player_id: giver_id,
                amount: -amount,
                reason: reason.to_string(),
            });
        }

        events.push(GameEvent::MoneyChanged {
            player_id: recipient_id,
            amount: amount * (new_state.players.len() as i64 - 1),
            reason: format!("{}(受取)", reason),
        });

        (new_state, events)
    }
}

impl EventResolver for ClassicEventResolver {
    fn resolve_tile(&self, state: &GameState, tile: &Tile) -> (GameState, Vec<GameEvent>) {
        let mut new_state = state.clone();
        let mut events = Vec::new();
        let player_idx = new_state.current_turn;
        let player_id = new_state.players[player_idx].id.clone();

        match tile.tile_type {
            TileType::Payday => {
                let salary = new_state.players[player_idx].salary as i64;
                new_state.players[player_idx].money += salary;
                events.push(GameEvent::MoneyChanged {
                    player_id,
                    amount: salary,
                    reason: "給料日".to_string(),
                });
            }

            TileType::Action => {
                if let Some(TileEvent::Money { amount, ref text }) = tile.event {
                    new_state.players[player_idx].money += amount;
                    events.push(GameEvent::MoneyChanged {
                        player_id,
                        amount,
                        reason: text.clone(),
                    });
                }
            }

            TileType::Career => {
                // seedベースで職業割り当て
                let pool = match &tile.event {
                    Some(TileEvent::DrawCareer { pool }) => pool.clone(),
                    _ => "basic".to_string(),
                };
                let available: Vec<Career> = new_state
                    .careers
                    .iter()
                    .filter(|c| c.pool == pool)
                    .cloned()
                    .collect();
                if !available.is_empty() {
                    let idx = (new_state.next_random() as usize) % available.len();
                    let career = available[idx].clone();
                    new_state.players[player_idx].salary = career.salary;
                    new_state.players[player_idx].career = Some(career.clone());
                    events.push(GameEvent::CareerAssigned {
                        player_id,
                        career,
                    });
                }
            }

            TileType::House => {
                // 家の選択肢を提示
                let choices: Vec<GameChoice> = new_state
                    .houses_for_sale
                    .iter()
                    .map(|h| GameChoice {
                        id: h.id.clone(),
                        label: format!("{} (${} / 売却${})", h.name, h.price, h.sell_price),
                    })
                    .chain(std::iter::once(GameChoice {
                        id: "skip".to_string(),
                        label: "購入しない".to_string(),
                    }))
                    .collect();
                new_state.phase = TurnPhase::ChoosingAction;
                events.push(GameEvent::ChoiceRequired { choices });
            }

            TileType::Marry => {
                if !new_state.players[player_idx].married {
                    new_state.players[player_idx].married = true;
                    events.push(GameEvent::Married {
                        player_id: player_id.clone(),
                    });
                    // ご祝儀
                    let (gift_state, gift_events) =
                        Self::gift_from_others(&new_state, player_idx, 5000, "ご祝儀");
                    new_state = gift_state;
                    events.extend(gift_events);
                }
            }

            TileType::Baby => {
                if new_state.players[player_idx].children < 6 {
                    new_state.players[player_idx].children += 1;
                    let children = new_state.players[player_idx].children;
                    events.push(GameEvent::BabyBorn {
                        player_id: player_id.clone(),
                        children,
                    });
                    // お祝い金
                    let (gift_state, gift_events) =
                        Self::gift_from_others(&new_state, player_idx, 5000, "出産祝い");
                    new_state = gift_state;
                    events.extend(gift_events);
                }
            }

            TileType::Stock => {
                // 株購入: $10,000
                let cost = 10_000i64;
                if new_state.players[player_idx].money >= cost {
                    new_state.players[player_idx].money -= cost;
                    let stock_id = format!("stock_{}", new_state.next_random() % 100);
                    new_state.players[player_idx].stocks.push(Stock {
                        id: stock_id,
                        name: "株券".to_string(),
                    });
                    events.push(GameEvent::StockPurchased {
                        player_id,
                    });
                }
            }

            TileType::Insurance => {
                let mut choices = Vec::new();
                if !new_state.players[player_idx].life_insurance {
                    choices.push(GameChoice {
                        id: "life".to_string(),
                        label: "生命保険に加入".to_string(),
                    });
                }
                if !new_state.players[player_idx].auto_insurance {
                    choices.push(GameChoice {
                        id: "auto".to_string(),
                        label: "自動車保険に加入".to_string(),
                    });
                }
                choices.push(GameChoice {
                    id: "skip".to_string(),
                    label: "加入しない".to_string(),
                });
                new_state.phase = TurnPhase::ChoosingAction;
                events.push(GameEvent::ChoiceRequired { choices });
            }

            TileType::Tax => {
                let tax = (new_state.players[player_idx].salary as f64 * 0.1) as i64;
                let tax = if tax > 0 { tax } else { 5000 };
                new_state.players[player_idx].money -= tax;
                events.push(GameEvent::MoneyChanged {
                    player_id,
                    amount: -tax,
                    reason: "税金".to_string(),
                });
            }

            TileType::Lawsuit => {
                // 他プレイヤー選択
                let choices: Vec<GameChoice> = new_state
                    .players
                    .iter()
                    .enumerate()
                    .filter(|(i, p)| *i != player_idx && !p.retired)
                    .map(|(_, p)| GameChoice {
                        id: p.id.clone(),
                        label: format!("{}を訴える", p.name),
                    })
                    .collect();
                if !choices.is_empty() {
                    new_state.phase = TurnPhase::ChoosingAction;
                    events.push(GameEvent::ChoiceRequired { choices });
                }
            }

            TileType::Branch => {
                // 分岐マス: path選択フェーズへ
                new_state.phase = TurnPhase::ChoosingPath;
                let labels = tile.labels.clone().unwrap_or_default();
                let choices: Vec<GameChoice> = tile
                    .next
                    .iter()
                    .enumerate()
                    .map(|(i, _)| GameChoice {
                        id: i.to_string(),
                        label: labels.get(i).cloned().unwrap_or_else(|| format!("道 {}", i + 1)),
                    })
                    .collect();
                events.push(GameEvent::ChoiceRequired { choices });
            }

            TileType::Retire => {
                new_state.players[player_idx].retired = true;
                events.push(GameEvent::PlayerRetired { player_id });
            }

            TileType::Start => {
                // Startマスに止まっても何もしない (ゲーム開始時に分岐選択)
                // ただしnextが複数あれば分岐として扱う
                if tile.next.len() > 1 {
                    new_state.phase = TurnPhase::ChoosingPath;
                    let labels = tile.labels.clone().unwrap_or_default();
                    let choices: Vec<GameChoice> = tile
                        .next
                        .iter()
                        .enumerate()
                        .map(|(i, _)| GameChoice {
                            id: i.to_string(),
                            label: labels.get(i).cloned().unwrap_or_else(|| format!("道 {}", i + 1)),
                        })
                        .collect();
                    events.push(GameEvent::ChoiceRequired { choices });
                }
            }
        }

        (new_state, events)
    }

    fn resolve_payday(&self, state: &GameState, player_index: usize) -> GameState {
        let mut new_state = state.clone();
        let salary = new_state.players[player_index].salary as i64;
        new_state.players[player_index].money += salary;
        new_state
    }

    fn resolve_lawsuit(&self, state: &GameState, target: &PlayerId) -> (GameState, Vec<GameEvent>) {
        let mut new_state = state.clone();
        let mut events = Vec::new();
        let lawsuit_amount = 100_000i64;
        let current_id = new_state.players[new_state.current_turn].id.clone();

        if let Some(target_idx) = new_state.players.iter().position(|p| &p.id == target) {
            new_state.players[target_idx].money -= lawsuit_amount;
            new_state.players[new_state.current_turn].money += lawsuit_amount;

            events.push(GameEvent::MoneyChanged {
                player_id: target.clone(),
                amount: -lawsuit_amount,
                reason: "訴訟(支払い)".to_string(),
            });
            events.push(GameEvent::MoneyChanged {
                player_id: current_id,
                amount: lawsuit_amount,
                reason: "訴訟(受取)".to_string(),
            });
        }

        (new_state, events)
    }
}
