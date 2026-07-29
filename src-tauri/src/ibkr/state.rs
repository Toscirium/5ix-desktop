use std::collections::HashMap;
use std::sync::Arc;

use ibapi::contracts::Contract;
use ibapi::Client;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

#[derive(Default)]
pub struct AppState {
    pub client: Mutex<Option<Arc<Client>>>,
    pub watchlist_tasks: Mutex<HashMap<String, JoinHandle<()>>>,
    pub order_stream_task: Mutex<Option<JoinHandle<()>>>,
    pub open_order_contracts: Mutex<HashMap<i32, Contract>>,
    pub selected_account: Mutex<Option<String>>,
    pub pnl_task: Mutex<Option<JoinHandle<()>>>,
    pub depth_task: Mutex<Option<JoinHandle<()>>>,
}
