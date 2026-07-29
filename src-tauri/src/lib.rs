mod ibkr;

use ibkr::commands::{
    add_watchlist_instrument, cancel_order, get_account_summary, get_executions, get_historical_bars, get_news, get_news_article,
    get_open_orders, get_option_chain, get_option_snapshot, get_positions, ibkr_connect, ibkr_disconnect, is_connected, modify_order,
    place_order, remove_watchlist_instrument, run_scanner, search_symbols, select_account, subscribe_market_depth, subscribe_pnl,
    unsubscribe_market_depth,
};
use ibkr::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            ibkr_connect,
            ibkr_disconnect,
            is_connected,
            select_account,
            subscribe_pnl,
            subscribe_market_depth,
            unsubscribe_market_depth,
            add_watchlist_instrument,
            remove_watchlist_instrument,
            place_order,
            get_positions,
            get_account_summary,
            get_historical_bars,
            get_open_orders,
            get_executions,
            cancel_order,
            modify_order,
            run_scanner,
            search_symbols,
            get_news,
            get_news_article,
            get_option_chain,
            get_option_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
