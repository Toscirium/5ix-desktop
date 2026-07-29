use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatusDto {
    pub connected: bool,
    pub server_version: Option<i32>,
    pub error: Option<String>,
    #[serde(default)]
    pub accounts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QuoteDto {
    pub key: String,
    pub symbol: String,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub last: Option<f64>,
    pub close: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub bid_size: Option<f64>,
    pub ask_size: Option<f64>,
    pub last_size: Option<f64>,
    pub volume: Option<f64>,
}

impl QuoteDto {
    pub fn new(key: String, symbol: String) -> Self {
        Self {
            key,
            symbol,
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionDto {
    pub account: String,
    pub symbol: String,
    pub local_symbol: String,
    pub security_type: String,
    pub strike: Option<f64>,
    pub right: Option<String>,
    pub expiry: Option<String>,
    pub exchange: String,
    pub currency: String,
    pub position: f64,
    pub average_cost: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountValueDto {
    pub account: String,
    pub tag: String,
    pub value: String,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrderUpdateDto {
    pub order_id: i32,
    pub kind: String,
    pub status: Option<String>,
    pub filled: Option<f64>,
    pub remaining: Option<f64>,
    pub avg_fill_price: Option<f64>,
    pub symbol: Option<String>,
    pub side: Option<String>,
    pub shares: Option<f64>,
    pub price: Option<f64>,
    pub commission: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenOrderDto {
    pub order_id: i32,
    pub symbol: String,
    pub security_type: String,
    pub action: String,
    pub order_type: String,
    pub total_quantity: f64,
    pub limit_price: Option<f64>,
    pub aux_price: Option<f64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PnlDto {
    pub daily_pnl: f64,
    pub unrealized_pnl: Option<f64>,
    pub realized_pnl: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptionChainDto {
    pub expirations: Vec<String>,
    pub strikes: Vec<f64>,
    pub trading_class: String,
    pub multiplier: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptionSnapshotDto {
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub last: Option<f64>,
    pub delta: Option<f64>,
    pub gamma: Option<f64>,
    pub theta: Option<f64>,
    pub vega: Option<f64>,
    pub implied_vol: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DepthLevelDto {
    pub price: f64,
    pub size: f64,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DepthBookDto {
    pub bids: Vec<Option<DepthLevelDto>>,
    pub asks: Vec<Option<DepthLevelDto>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BracketOrderIdsDto {
    pub parent_id: i32,
    pub take_profit_id: i32,
    pub stop_loss_id: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionDto {
    pub order_id: i32,
    pub symbol: String,
    pub security_type: String,
    pub side: String,
    pub shares: f64,
    pub price: f64,
    pub time: String,
    pub exchange: String,
    pub commission: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolMatchDto {
    pub symbol: String,
    pub security_type: String,
    pub primary_exchange: String,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannerRowDto {
    pub rank: i32,
    pub symbol: String,
    pub exchange: String,
    pub security_type: String,
    pub long_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsArticleDto {
    pub time: i64,
    pub provider_code: String,
    pub article_id: String,
    pub headline: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BarDto {
    pub time: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}
