mod chat;
mod config;
mod game;
mod protocol;
mod room;
mod transport;
mod web;

use std::sync::Arc;

use axum::extract::ws::WebSocket;
use axum::extract::{State, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};

use crate::config::ServerConfig;
use crate::protocol::{ClientMessage, ServerMessage};
use crate::room::RoomManager;
use crate::transport::{split_websocket, Transport};

type AppState = Arc<RoomManager>;

#[tokio::main]
async fn main() {
    let config = ServerConfig::default();
    let room_manager = Arc::new(RoomManager::new(config.max_players_per_room));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/room/{id}", get(web::invite_page))
        .route("/api/room/{id}", get(web::room_info))
        .route("/ws", get(ws_upgrade))
        .layer(cors)
        .with_state(room_manager);

    let addr = config.addr();
    println!("9-life server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(room_manager): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, room_manager))
}

async fn handle_socket(socket: WebSocket, room_manager: AppState) {
    let (sender, mut receiver) = split_websocket(socket);

    // 最初のメッセージで CreateRoom か JoinRoom を待つ
    let (room_id, player_id, player_name) = match receiver.recv().await {
        Ok(ClientMessage::CreateRoom {
            player_name,
            map_id,
        }) => {
            let sender_clone = sender.clone();
            let transport_arc: Arc<dyn Transport> = Arc::new(sender_clone);
            let (room_id, player_id) = room_manager
                .create_room(player_name.clone(), map_id, transport_arc)
                .await;

            let invite_url = format!("/room/{}", room_id);
            let msg = ServerMessage::RoomCreated {
                room_id: room_id.clone(),
                invite_url,
                player_id: player_id.clone(),
            };
            let _ = sender.send(msg).await;

            // ホスト自身のプレイヤー情報を含むRoomStateを送信
            let room_state = ServerMessage::RoomState {
                room_id: room_id.clone(),
                player_id: player_id.clone(),
                players: vec![crate::protocol::PlayerInfo {
                    id: player_id.clone(),
                    name: player_name.clone(),
                }],
                status: "Lobby".to_string(),
            };
            let _ = sender.send(room_state).await;

            (room_id, player_id, player_name)
        }
        Ok(ClientMessage::JoinRoom {
            room_id,
            player_name,
        }) => {
            let sender_clone = sender.clone();
            let transport_arc: Arc<dyn Transport> = Arc::new(sender_clone);
            match room_manager
                .join_room(&room_id, player_name.clone(), transport_arc)
                .await
            {
                Ok(player_id) => {
                    // 参加を他のプレイヤーに通知
                    let msg = ServerMessage::PlayerJoined {
                        player_id: player_id.clone(),
                        player_name: player_name.clone(),
                    };
                    room_manager.broadcast(&room_id, &msg).await;

                    // 参加者に現在のルーム状態を送信（roomIdとプレイヤー一覧）
                    if let Some(info) = room_manager.get_room_info(&room_id).await {
                        let room_state = ServerMessage::RoomState {
                            room_id: room_id.clone(),
                            player_id: player_id.clone(),
                            players: info.players,
                            status: info.status,
                        };
                        let _ = sender.send(room_state).await;
                    }

                    (room_id, player_id, player_name)
                }
                Err(e) => {
                    let msg = ServerMessage::Error {
                        code: "JOIN_FAILED".to_string(),
                        message: e,
                    };
                    let _ = sender.send(msg).await;
                    return;
                }
            }
        }
        Ok(_) => {
            let msg = ServerMessage::Error {
                code: "INVALID_FIRST_MESSAGE".to_string(),
                message: "Expected CreateRoom or JoinRoom".to_string(),
            };
            let _ = sender.send(msg).await;
            return;
        }
        Err(_) => return,
    };

    // メッセージループ
    loop {
        match receiver.recv().await {
            Ok(ClientMessage::ChatMessage { text }) => {
                chat::handle_chat(
                    &room_manager,
                    &room_id,
                    &player_id,
                    &player_name,
                    text,
                )
                .await;
            }
            Ok(ClientMessage::LeaveRoom) => {
                let _ = room_manager.leave_room(&room_id, &player_id).await;
                let msg = ServerMessage::PlayerLeft {
                    player_id: player_id.clone(),
                };
                room_manager.broadcast(&room_id, &msg).await;
                break;
            }
            Ok(ClientMessage::StartGame) => {
                match room_manager.start_game(&room_id, &player_id).await {
                    Ok(msgs) => {
                        for msg in msgs {
                            room_manager.broadcast(&room_id, &msg).await;
                        }
                    }
                    Err(e) => {
                        let _ = sender
                            .send(ServerMessage::Error {
                                code: "GAME_ERROR".to_string(),
                                message: e,
                            })
                            .await;
                    }
                }
            }
            Ok(ClientMessage::SpinRoulette) => {
                match room_manager.spin_roulette(&room_id, &player_id).await {
                    Ok(msgs) => {
                        for msg in msgs {
                            room_manager.broadcast(&room_id, &msg).await;
                        }
                    }
                    Err(e) => {
                        let _ = sender
                            .send(ServerMessage::Error {
                                code: "GAME_ERROR".to_string(),
                                message: e,
                            })
                            .await;
                    }
                }
            }
            Ok(ClientMessage::ChoicePath { path_index }) => {
                match room_manager
                    .choose_path(&room_id, &player_id, path_index)
                    .await
                {
                    Ok(msgs) => {
                        for msg in msgs {
                            room_manager.broadcast(&room_id, &msg).await;
                        }
                    }
                    Err(e) => {
                        let _ = sender
                            .send(ServerMessage::Error {
                                code: "GAME_ERROR".to_string(),
                                message: e,
                            })
                            .await;
                    }
                }
            }
            Ok(ClientMessage::ChoiceAction { action_id }) => {
                match room_manager
                    .choose_action(&room_id, &player_id, action_id)
                    .await
                {
                    Ok(msgs) => {
                        for msg in msgs {
                            room_manager.broadcast(&room_id, &msg).await;
                        }
                    }
                    Err(e) => {
                        let _ = sender
                            .send(ServerMessage::Error {
                                code: "GAME_ERROR".to_string(),
                                message: e,
                            })
                            .await;
                    }
                }
            }
            Ok(_) => {
                let _ = sender
                    .send(ServerMessage::Error {
                        code: "UNKNOWN_MESSAGE".to_string(),
                        message: "Unrecognized message type".to_string(),
                    })
                    .await;
            }
            Err(_) => {
                // 接続切断時の処理
                let _ = room_manager.leave_room(&room_id, &player_id).await;
                let msg = ServerMessage::PlayerLeft {
                    player_id: player_id.clone(),
                };
                room_manager.broadcast(&room_id, &msg).await;
                break;
            }
        }
    }
}
