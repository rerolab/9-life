/// サーバー設定
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub max_players_per_room: usize,
    pub max_rooms: usize,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 3000,
            max_players_per_room: 6,
            max_rooms: 100,
        }
    }
}

impl ServerConfig {
    pub fn addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
