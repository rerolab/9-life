# 9-life 設計書

**プロジェクト名:** 9-life
**種別:** 「人生ゲーム」互換クロスプラットフォームアプリ
**作成日:** 2026-02-10

---

## 1. 概要

ボードゲーム「人生ゲーム（The Game of Life）」互換のマルチプレイヤーアプリケーション。Tauri v2.0によるクロスプラットフォームGUIクライアントと、Rustによる専用ゲームサーバーで構成される。

### 基本仕様

| 項目 | 内容 |
|---|---|
| プレイヤー人数 | 2〜6人 |
| サーバー構成 | 専用サーバー方式（Rust / axum） |
| 通信 | WebSocket（JSON） |
| クライアント | Tauri v2.0 + React + TypeScript |
| データベース | なし（初期リリース） |
| 部屋参加 | Webページ経由のURL参加 / 部屋IDでの直接参加 |

---

## 2. アーキテクチャ

```
┌─────────────────┐     WebSocket      ┌─────────────────────┐
│  Tauri v2 Client │◄──────────────────►│   Game Server (Rust) │
│  (React + TS)    │                    │                      │
│                  │     HTTP           │  - Room Manager      │
│  - Game UI       │◄──────────────────►│  - Game Engine       │
│  - Chat UI       │                    │  - Chat Handler      │
│  - Roulette      │                    │  - Web Page (JOIN)   │
└─────────────────┘                    └─────────────────────┘
```

- **サーバー（Rust / axum）:** ゲームロジック・部屋管理・チャットをすべてサーバー側で処理。サーバー権威モデル。
- **クライアント（Tauri v2 + React + TS）:** WebSocket経由でサーバーと通信。描画と入力を担当。

### トランスポート抽象化

将来的なBluetooth対応を見据え、通信をトレイトで抽象化する。

```rust
trait Transport: Send + Sync {
    async fn send(&self, msg: GameMessage) -> Result<()>;
    async fn recv(&mut self) -> Result<GameMessage>;
}

struct WebSocketTransport { /* ... */ }
// 将来: struct BluetoothTransport { /* ... */ }
```

---

## 3. 通信プロトコル

サーバー・クライアント間のメッセージはJSONでシリアライズする。

### クライアント → サーバー

| メッセージ | フィールド | 説明 |
|---|---|---|
| `CreateRoom` | `player_name, map_id` | 部屋作成 |
| `JoinRoom` | `room_id, player_name` | 部屋参加 |
| `LeaveRoom` | — | 部屋退出 |
| `SpinRoulette` | — | ルーレット回転リクエスト |
| `ChoicePath` | `path_index` | 分岐マスでの選択 |
| `ChoiceAction` | `action_id` | イベント選択（家購入、保険加入など） |
| `ChatMessage` | `text` | チャット送信 |

### サーバー → クライアント

| メッセージ | フィールド | 説明 |
|---|---|---|
| `RoomCreated` | `room_id, invite_url` | 部屋作成完了 |
| `PlayerJoined` | `player` | プレイヤー入室通知 |
| `PlayerLeft` | `player_id` | プレイヤー退出通知 |
| `GameStarted` | `board, players, turn_order` | ゲーム開始 |
| `RouletteResult` | `player_id, value` | ルーレット結果 |
| `PlayerMoved` | `player_id, position, event` | 移動＋イベント発生 |
| `EventResult` | `player_id, changes` | イベント処理結果 |
| `ChoiceRequired` | `choices` | 選択肢の提示 |
| `GameEnded` | `rankings` | ゲーム終了 |
| `ChatBroadcast` | `player_id, text` | チャット配信 |
| `Error` | `code, message` | エラー通知 |

---

## 4. ゲームロジック

### 4.1. ゲームロジック トレイト設計

ゲームロジックはトレイトで抽象化し、異なるルールセットを差し替え可能にする。

```rust
/// ゲーム全体の状態（シリアライズ可能）
#[derive(Clone, Serialize, Deserialize)]
pub struct GameState {
    pub players: Vec<PlayerState>,
    pub board: Board,
    pub current_turn: usize,
    pub phase: TurnPhase,
    pub rng_seed: u64,
}

/// ゲームエンジンのコアトレイト
/// 全メソッドが &GameState を受け取り、新しい GameState を返す（イミュータブル設計）
pub trait GameEngine: Send + Sync {
    /// ゲーム初期状態を生成
    fn init(&self, players: Vec<PlayerInfo>, map: &MapData) -> GameState;

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
    fn resolve_payday(&self, state: &GameState) -> GameState;

    /// 訴訟の処理
    fn resolve_lawsuit(&self, state: &GameState, target: PlayerId) -> (GameState, Vec<GameEvent>);
}

/// ルーレット（乱数生成）の抽象化
pub trait Roulette: Send + Sync {
    fn spin(&self, state: &GameState) -> u32; // 1〜10
}

/// 本家準拠の実装
pub struct ClassicGameEngine {
    event_resolver: Box<dyn EventResolver>,
    roulette: Box<dyn Roulette>,
}

impl GameEngine for ClassicGameEngine { /* ... */ }
```

**設計方針：**
- **イミュータブル** — `&GameState` を受け取り新しい `GameState` を返す。履歴管理・リプレイ・デバッグが容易。
- **コンポーザブル** — `EventResolver` と `Roulette` を個別に差し替え可能。
- **再実装が容易** — `GameEngine` トレイトを実装するだけで全く異なるルールのゲームを作れる。

### 4.2. プレイヤーの状態

| 項目 | 初期値 | 説明 |
|---|---|---|
| 所持金 | $10,000 | ゲーム内通貨 |
| 職業 | なし | 就職マスで決定 |
| 給料額 | 0 | 職業に紐づく |
| 配偶者 | なし | 結婚マスで変化 |
| 子供の人数 | 0 | 最大6人程度 |
| 生命保険 | 未加入 | 保険マスで選択 |
| 自動車保険 | 未加入 | 保険マスで選択 |
| 株券 | なし | 株マスで購入 |
| 家 | なし | 購入した家のリスト |
| 借金 | 0 | $20,000単位、返済時は利子1.25倍 |
| 約束手形 | なし | 報酬カード |

### 4.3. マスの種類

| マス種別 | 説明 |
|---|---|
| `Start` | スタート地点。大学ルート or 就職ルートの分岐 |
| `Payday` | 給料日。給料額を受け取る |
| `Action` | お金の増減イベント（ランダム or 固定） |
| `Career` | 職業カードを引く/変更 |
| `House` | 家を購入（複数価格帯から選択） |
| `Marry` | 結婚。ご祝儀を他プレイヤーから受け取る |
| `Baby` | 子供誕生。他プレイヤーからお祝い金 |
| `Stock` | 株券購入 |
| `Insurance` | 保険加入の選択 |
| `Tax` | 税金支払い |
| `Lawsuit` | 訴訟（他プレイヤーを指名して賠償請求） |
| `Branch` | 分岐マス（プレイヤーが道を選ぶ） |
| `Retire` | ゴール。引退先を選択（億万長者の丘 or カントリーハウス） |

### 4.4. 勝利判定

全員がゴール後、資産（所持金 + 家の売却額 + 約束手形 - 借金）の合計で順位を決定。

### 4.5. ルーレット

本家準拠で1〜10の数値が出るルーレット。クリック/タップでストップ。アニメーション付き。

---

## 5. マップデータ構造（JSON定義）

カスタムマップをJSON形式で定義し、読み込み可能にする。

```json
{
  "id": "classic",
  "name": "クラシック人生ゲーム",
  "version": "1.0",
  "start_money": 10000,
  "loan_unit": 20000,
  "loan_interest_rate": 1.25,
  "tiles": [
    {
      "id": 0,
      "type": "Start",
      "position": { "x": 0, "y": 0 },
      "next": [1, 50]
    },
    {
      "id": 1,
      "type": "Career",
      "position": { "x": 1, "y": 0 },
      "next": [2],
      "event": { "type": "draw_career", "pool": "basic" }
    },
    {
      "id": 10,
      "type": "Branch",
      "position": { "x": 5, "y": 2 },
      "next": [11, 30],
      "labels": ["安全な道", "冒険の道"]
    },
    {
      "id": 25,
      "type": "Action",
      "position": { "x": 8, "y": 3 },
      "next": [26],
      "event": { "type": "money", "amount": -5000, "text": "交通事故！修理費を支払う" }
    }
  ],
  "careers": [
    { "id": "doctor", "name": "医者", "salary": 50000, "pool": "college" },
    { "id": "artist", "name": "芸術家", "salary": 20000, "pool": "basic" }
  ],
  "houses": [
    { "id": "cottage", "name": "コテージ", "price": 40000, "sell_price": 60000 }
  ]
}
```

**ポイント：**
- `tiles[].next` が配列なので分岐を表現可能
- `position` はフロントエンドのレンダリング座標
- 職業・家・イベントのデータもマップJSON内に含め、カスタムマップで自由に変更可能

---

## 6. 部屋管理

### 6.1. 部屋のライフサイクル

```
作成 → 待機中(Lobby) → ゲーム中(Playing) → 終了(Finished) → 削除
```

### 6.2. 部屋の状態

```rust
pub struct Room {
    pub id: RoomId,           // 6文字の英数字 (例: "A3K9F2")
    pub host: PlayerId,       // 部屋作成者
    pub players: Vec<Player>, // 最大6人
    pub status: RoomStatus,   // Lobby / Playing / Finished
    pub map_id: String,       // 使用マップ
    pub game_state: Option<GameState>,
    pub created_at: Instant,
}
```

### 6.3. 参加フロー

```
1. ホストが部屋を作成
   → サーバーが RoomId を発行
   → 招待URL生成: https://server.example/room/A3K9F2

2a. URL経由の参加
   ブラウザでURLにアクセス
   → Webページ表示（部屋情報 + 参加ボタン）
   → 「アプリで参加」ボタン → カスタムURI: 9life://join/A3K9F2
   → 「アプリ未インストール」リンク → ダウンロードページ

2b. アプリ内での参加
   アプリ起動 → 部屋IDを手入力 → 参加
```

### 6.4. HTTPエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/room/:id` | 招待Webページ（HTML） |
| `GET` | `/api/room/:id` | 部屋情報JSON（ステータス確認用） |
| `GET` | `/ws` | WebSocketアップグレード |

Webページはサーバーに埋め込んだ軽量HTMLで、React不要のシンプルな1ページ。

---

## 7. テキストチャット

WebSocket上のメッセージとしてチャットを実装する。

- `ChatMessage { text }` — クライアントからの送信
- `ChatBroadcast { player_id, text }` — サーバーから全員に配信
- 同一の部屋内のプレイヤーにのみ配信

---

## 8. プロジェクト構成

```
9-life/
├── server/                    # ゲームサーバー (Rust)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs            # エントリポイント (axum起動)
│       ├── config.rs          # サーバー設定
│       ├── transport/         # トランスポート抽象化
│       │   ├── mod.rs
│       │   ├── traits.rs      # Transport トレイト
│       │   └── websocket.rs   # WebSocket実装
│       ├── room/              # 部屋管理
│       │   ├── mod.rs
│       │   ├── manager.rs     # RoomManager
│       │   └── models.rs      # Room, RoomStatus
│       ├── game/              # ゲームロジック
│       │   ├── mod.rs
│       │   ├── traits.rs      # GameEngine, EventResolver, Roulette トレイト
│       │   ├── engine.rs      # ClassicGameEngine 実装
│       │   ├── state.rs       # GameState, PlayerState
│       │   └── events.rs      # イベント定義・処理
│       ├── protocol/          # 通信プロトコル
│       │   ├── mod.rs
│       │   └── messages.rs    # クライアント/サーバーメッセージ定義
│       ├── chat/              # チャット機能
│       │   └── mod.rs
│       └── web/               # 招待Webページ
│           ├── mod.rs
│           └── templates/     # HTML テンプレート
│               └── invite.html
├── client/                    # Tauriクライアント
│   ├── src-tauri/             # Tauri (Rust側)
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── src/
│   │       └── main.rs
│   ├── src/                   # React (TypeScript側)
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Board.tsx      # ゲームボード描画
│   │   │   ├── Roulette.tsx   # ルーレットUI
│   │   │   ├── PlayerInfo.tsx # プレイヤー情報表示
│   │   │   ├── Chat.tsx       # チャットUI
│   │   │   ├── Lobby.tsx      # 待機画面
│   │   │   └── EventDialog.tsx # イベント選択ダイアログ
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts # WebSocket接続管理
│   │   │   └── useGameState.ts # ゲーム状態管理
│   │   ├── types/
│   │   │   └── protocol.ts    # メッセージ型定義 (サーバーと共通)
│   │   └── assets/
│   │       └── maps/
│   │           └── classic.json # クラシックマップ
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   └── plans/                 # 設計ドキュメント
└── README.md
```

- `server/` と `client/` を完全分離。独立してビルド・デプロイ可能。
- ゲームロジック(`game/`)はトレイトベースで差し替え可能。
- トランスポート(`transport/`)も抽象化済み。
- プロトコル定義(`protocol/`)はサーバー側に置き、クライアント側のTS型と手動で同期（将来的に自動生成も可能）。

---

## 9. リリーススコープ（優先順位）

1. サーバー + 部屋管理（作成・参加・退出）
2. WebSocketによるリアルタイム通信
3. ゲームボードのレンダリング（JSONマップ読み込み）
4. 本家準拠のゲームロジック（ルーレット、マスイベント、勝利判定）
5. テキストチャット
6. Webページ経由の部屋参加

### 将来対応（初期リリース対象外）

- マップエディタ
- Bluetooth トランスポート
- カスタムイベントスクリプト
- データベース連携（戦績保存など）
