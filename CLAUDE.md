# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

### Server (Rust)
```bash
cd server && cargo build          # デバッグビルド
cd server && cargo test           # テスト実行（ゲームエンジン）
cd server && cargo test <test_name>  # 単体テスト実行
```

### Client (Tauri + React)
```bash
cd client && npm install          # 依存関係インストール
cd client && npm run dev          # Vite開発サーバー (port 1420)
cd client && npm run build        # tsc + vite ビルド → dist/
```

### Tauri Desktop
```bash
cd client && npm run tauri dev    # デスクトップアプリ開発モード
cd client && npm run tauri build  # デスクトップアプリビルド
```

## Architecture

「人生ゲーム（The Game of Life）」互換のマルチプレイヤーWebSocket対戦ゲーム。2〜6人対応。

### Server-Authoritative Model
- ゲームロジックはすべてサーバー側で処理。クライアントは描画と入力のみ
- `RoomManager`が全ゲーム操作を管理し、各メソッドは`Vec<ServerMessage>`を返してブロードキャスト

### Trait-Based Game Engine (`server/src/game/`)
- `GameEngine` trait → `ClassicGameEngine`実装
- `EventResolver` trait → `ClassicEventResolver`実装
- `Roulette` trait → `StandardRoulette`実装
- **イミュータブル設計**: 全メソッドが`&GameState`を受け取り、新しい`GameState`を返す

### Transport Abstraction (`server/src/transport/`)
- `Transport` traitでWebSocket通信を抽象化（将来的にBluetooth対応を想定）
- `WsSender`/`WsReceiver`がWebSocket実装

### Client State Management (`client/src/hooks/`)
- `useGameState`: `useReducer`パターンで`AppState`を管理。reducerが全`ServerMessage`を処理
- `useWebSocket`: WebSocket接続管理。JSON送受信

### Key Components (`client/src/components/`)
- `Board`: SVGでタイルとプレイヤー位置を描画
- `Roulette`: 1〜10のスピンアニメーション
- `EventDialog`: `mode: "path" | "action"`で分岐選択とイベント選択を処理

## Protocol

WebSocket JSON通信。`type`フィールドでメッセージを識別（serde taggedEnum / TypeScript discriminated union）。

- **Client→Server**: CreateRoom, JoinRoom, LeaveRoom, StartGame, SpinRoulette, ChoicePath, ChoiceAction, ChatMessage
- **Server→Client**: RoomCreated, PlayerJoined, PlayerLeft, GameStarted, GameSync, RouletteResult, PlayerMoved, ChoiceRequired, TurnChanged, GameEnded, ChatBroadcast, Error, RoomState

プロトコル型はサーバー(`server/src/protocol/messages.rs`)とクライアント(`client/src/types/protocol.ts`)で手動同期。

## Game Map Data

マップはJSON形式（`server/src/classic.json`, `client/src/assets/maps/classic.json`）。サーバーは`include_str!()`でバイナリに埋め込み。`tiles[].next`配列で分岐を表現。

## Turn Flow

`TurnPhase`: WaitingForSpin → Spinning → Moving → ResolvingEvent / ChoosingPath / ChoosingAction → TurnEnd

## Deployment

- **Server**: Fly.io (nrt region), port 3000, Dockerfile multi-stage build (Rust 1.85)
- **Web Client**: GitHub Pages (`deploy-web.yml`)
- **Desktop Client**: Tauri releases (`release-client.yml`)
- 環境変数: `VITE_WS_URL`（WebSocket URL上書き）, `VITE_BASE`（GitHub Pagesベースパス）

## Language

UIテキストとコメントは日本語。
