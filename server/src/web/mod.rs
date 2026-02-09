use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Html;

/// 招待ページハンドラ
/// GET /room/:id で招待HTMLを返す
pub async fn invite_page(Path(_room_id): Path<String>) -> Html<&'static str> {
    Html(include_str!("templates/invite.html"))
}

/// 部屋情報API
/// GET /api/room/:id で部屋情報をJSONで返す
pub async fn room_info(
    Path(room_id): Path<String>,
    axum::extract::State(room_manager): axum::extract::State<std::sync::Arc<crate::room::RoomManager>>,
) -> Result<axum::Json<crate::room::manager::RoomInfo>, StatusCode> {
    match room_manager.get_room_info(&room_id).await {
        Some(info) => Ok(axum::Json(info)),
        None => Err(StatusCode::NOT_FOUND),
    }
}
