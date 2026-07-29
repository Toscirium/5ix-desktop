use std::sync::Arc;

use ibapi::accounts::types::{AccountGroup, AccountId};
use ibapi::contracts::tick_types::TickType;
use ibapi::market_data::historical::{Bar, BarTimestamp};
use ibapi::market_data::realtime::MarketDepths;
use ibapi::news::ArticleType;
use ibapi::orders::builder::{twap, vwap};
use ibapi::orders::Executions;
use ibapi::prelude::*;
use ibapi::scanner::ScannerSubscription;
use tauri::{AppHandle, Emitter, State};

use super::contracts::{build_contract, ContractSpec};
use super::dto::{
    AccountValueDto, BarDto, BracketOrderIdsDto, ConnectionStatusDto, DepthBookDto, DepthLevelDto, ExecutionDto, NewsArticleDto,
    OpenOrderDto, OptionChainDto, OptionSnapshotDto, OrderUpdateDto, PnlDto, PositionDto, QuoteDto, ScannerRowDto, SymbolMatchDto,
    TradeTickDto,
};
use super::state::AppState;

#[tauri::command]
pub async fn ibkr_connect(
    host: String,
    port: u16,
    client_id: i32,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ConnectionStatusDto, String> {
    let address = format!("{host}:{port}");
    let client = Client::connect(&address, client_id).await.map_err(|e| e.to_string())?;
    let client = Arc::new(client);
    let server_version = client.server_version();

    *state.client.lock().await = Some(client.clone());

    let handle = spawn_order_update_stream(app.clone(), client.clone());
    *state.order_stream_task.lock().await = Some(handle);

    let accounts = client.managed_accounts().await.unwrap_or_default();
    *state.selected_account.lock().await = accounts.first().cloned();

    let status = ConnectionStatusDto {
        connected: true,
        server_version: Some(server_version),
        error: None,
        accounts,
    };
    let _ = app.emit("connection-status", &status);
    Ok(status)
}

#[tauri::command]
pub async fn select_account(account: String, state: State<'_, AppState>) -> Result<(), String> {
    *state.selected_account.lock().await = Some(account);
    Ok(())
}

#[tauri::command]
pub async fn subscribe_pnl(account: String, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;

    if let Some(handle) = state.pnl_task.lock().await.take() {
        handle.abort();
    }

    let app_handle = app.clone();
    let handle = tokio::spawn(async move {
        let subscription = match client.pnl(&AccountId(account), None).await {
            Ok(s) => s,
            Err(e) => {
                let _ = app_handle.emit("pnl-error", e.to_string());
                return;
            }
        };

        let mut subscription = subscription.filter_data();
        while let Some(result) = subscription.next().await {
            match result {
                Ok(pnl) => {
                    let dto = PnlDto {
                        daily_pnl: pnl.daily_pnl,
                        unrealized_pnl: pnl.unrealized_pnl,
                        realized_pnl: pnl.realized_pnl,
                    };
                    let _ = app_handle.emit("pnl-update", &dto);
                }
                Err(e) => {
                    let _ = app_handle.emit("pnl-error", e.to_string());
                    break;
                }
            }
        }
    });

    *state.pnl_task.lock().await = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn subscribe_market_depth(
    spec: ContractSpec,
    rows: i32,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = build_contract(&spec)?;

    if let Some(handle) = state.depth_task.lock().await.take() {
        handle.abort();
    }

    let row_count = rows.max(1) as usize;
    let app_handle = app.clone();
    let handle = tokio::spawn(async move {
        let subscription = match client.market_depth(&contract, rows).smart_depth(SmartDepth::No).subscribe().await {
            Ok(s) => s,
            Err(e) => {
                let _ = app_handle.emit("depth-error", e.to_string());
                return;
            }
        };

        let mut bids: Vec<Option<DepthLevelDto>> = vec![None; row_count];
        let mut asks: Vec<Option<DepthLevelDto>> = vec![None; row_count];

        let mut subscription = subscription.filter_data();
        while let Some(item) = subscription.next().await {
            let (position, operation, side, price, size) = match item {
                Ok(MarketDepths::MarketDepth(d)) => (d.position, d.operation, d.side, d.price, d.size),
                Ok(MarketDepths::MarketDepthL2(d)) => (d.position, d.operation, d.side, d.price, d.size),
                Err(_) => break,
            };

            let book = if side == 1 { &mut bids } else { &mut asks };
            let idx = position as usize;
            if idx < book.len() {
                match operation {
                    0 | 1 => book[idx] = Some(DepthLevelDto { price, size }),
                    2 => book[idx] = None,
                    _ => {}
                }
            }

            let dto = DepthBookDto {
                bids: bids.clone(),
                asks: asks.clone(),
            };
            let _ = app_handle.emit("depth-update", &dto);
        }
    });

    *state.depth_task.lock().await = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn unsubscribe_market_depth(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(handle) = state.depth_task.lock().await.take() {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn subscribe_time_and_sales(spec: ContractSpec, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = build_contract(&spec)?;

    if let Some(handle) = state.tape_task.lock().await.take() {
        handle.abort();
    }

    let app_handle = app.clone();
    let handle = tokio::spawn(async move {
        let subscription = match client.tick_by_tick(&contract, 0).all_last().await {
            Ok(s) => s,
            Err(e) => {
                let _ = app_handle.emit("tape-error", e.to_string());
                return;
            }
        };

        let mut subscription = subscription.filter_data();
        while let Some(result) = subscription.next().await {
            let trade = match result {
                Ok(trade) => trade,
                Err(_) => break,
            };
            let dto = TradeTickDto {
                time: trade.time.unix_timestamp(),
                price: trade.price,
                size: trade.size,
                exchange: trade.exchange,
                special_conditions: trade.special_conditions,
                past_limit: trade.trade_attribute.past_limit,
                unreported: trade.trade_attribute.unreported,
            };
            let _ = app_handle.emit("tape-update", &dto);
        }
    });

    *state.tape_task.lock().await = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn unsubscribe_time_and_sales(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(handle) = state.tape_task.lock().await.take() {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn ibkr_disconnect(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let mut tasks = state.watchlist_tasks.lock().await;
    for (_, handle) in tasks.drain() {
        handle.abort();
    }
    drop(tasks);

    if let Some(handle) = state.order_stream_task.lock().await.take() {
        handle.abort();
    }
    if let Some(handle) = state.pnl_task.lock().await.take() {
        handle.abort();
    }
    if let Some(handle) = state.depth_task.lock().await.take() {
        handle.abort();
    }
    if let Some(handle) = state.tape_task.lock().await.take() {
        handle.abort();
    }

    if let Some(client) = state.client.lock().await.take() {
        client.disconnect().await;
    }
    *state.selected_account.lock().await = None;

    let _ = app.emit(
        "connection-status",
        &ConnectionStatusDto {
            connected: false,
            server_version: None,
            error: None,
            accounts: Vec::new(),
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn is_connected(state: State<'_, AppState>) -> Result<bool, String> {
    let client = state.client.lock().await;
    Ok(client.as_ref().map(|c| c.is_connected()).unwrap_or(false))
}

#[tauri::command]
pub async fn add_watchlist_instrument(
    key: String,
    label: String,
    spec: ContractSpec,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;

    if state.watchlist_tasks.lock().await.contains_key(&key) {
        return Ok(());
    }

    let contract = build_contract(&spec)?;
    let task_key = key.clone();
    let app_handle = app.clone();
    let handle = tokio::spawn(async move {
        let subscription = match client.market_data(&contract).subscribe().await {
            Ok(s) => s,
            Err(e) => {
                let _ = app_handle.emit("watchlist-error", format!("{label}: {e}"));
                return;
            }
        };

        let mut quote = QuoteDto::new(task_key, label);
        let mut stream = subscription.filter_data();
        while let Some(item) = stream.next().await {
            let tick = match item {
                Ok(tick) => tick,
                Err(_) => break,
            };

            let changed = match tick {
                TickTypes::Price(p) => match p.tick_type {
                    TickType::Bid => {
                        quote.bid = Some(p.price);
                        true
                    }
                    TickType::Ask => {
                        quote.ask = Some(p.price);
                        true
                    }
                    TickType::Last => {
                        quote.last = Some(p.price);
                        true
                    }
                    TickType::Close => {
                        quote.close = Some(p.price);
                        true
                    }
                    TickType::High => {
                        quote.high = Some(p.price);
                        true
                    }
                    TickType::Low => {
                        quote.low = Some(p.price);
                        true
                    }
                    _ => false,
                },
                TickTypes::Size(s) => match s.tick_type {
                    TickType::BidSize => {
                        quote.bid_size = Some(s.size);
                        true
                    }
                    TickType::AskSize => {
                        quote.ask_size = Some(s.size);
                        true
                    }
                    TickType::LastSize => {
                        quote.last_size = Some(s.size);
                        true
                    }
                    TickType::Volume => {
                        quote.volume = Some(s.size);
                        true
                    }
                    _ => false,
                },
                _ => false,
            };

            if changed {
                let _ = app_handle.emit("quote-update", &quote);
            }
        }
    });

    state.watchlist_tasks.lock().await.insert(key, handle);
    Ok(())
}

#[tauri::command]
pub async fn remove_watchlist_instrument(key: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(handle) = state.watchlist_tasks.lock().await.remove(&key) {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn place_order(
    spec: ContractSpec,
    side: String,
    quantity: f64,
    order_type: String,
    limit_price: Option<f64>,
    aux_price: Option<f64>,
    trailing_percent: Option<f64>,
    algo_strategy: Option<String>,
    algo_start_time: Option<String>,
    algo_end_time: Option<String>,
    algo_max_pct_vol: Option<f64>,
    state: State<'_, AppState>,
) -> Result<i32, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = build_contract(&spec)?;
    let account = state.selected_account.lock().await.clone();
    let builder = client.order(&contract);
    let builder = match side.to_uppercase().as_str() {
        "BUY" => builder.buy(quantity),
        "SELL" => builder.sell(quantity),
        other => return Err(format!("Invalid order side: {other}")),
    };
    let builder = match account {
        Some(account) => builder.account(account),
        None => builder,
    };

    let builder = match algo_strategy.as_deref() {
        Some("VWAP") => {
            let mut vwap_builder = vwap();
            if let Some(t) = algo_start_time.clone() {
                vwap_builder = vwap_builder.start_time(t);
            }
            if let Some(t) = algo_end_time.clone() {
                vwap_builder = vwap_builder.end_time(t);
            }
            if let Some(p) = algo_max_pct_vol {
                vwap_builder = vwap_builder.max_pct_vol(p);
            }
            let params = vwap_builder.build().map_err(|e| e.to_string())?;
            builder.algo(params)
        }
        Some("TWAP") => {
            let mut twap_builder = twap();
            if let Some(t) = algo_start_time.clone() {
                twap_builder = twap_builder.start_time(t);
            }
            if let Some(t) = algo_end_time.clone() {
                twap_builder = twap_builder.end_time(t);
            }
            let params = twap_builder.build().map_err(|e| e.to_string())?;
            builder.algo(params)
        }
        _ => builder,
    };

    let order_id = match order_type.to_uppercase().as_str() {
        "MARKET" => builder.market().submit().await.map_err(|e| e.to_string())?,
        "LIMIT" => {
            let price = limit_price.ok_or_else(|| "Limit price required for limit orders".to_string())?;
            builder.limit(price).submit().await.map_err(|e| e.to_string())?
        }
        "STOP" => {
            let stop_price = aux_price.ok_or_else(|| "Stop price required for stop orders".to_string())?;
            builder.stop(stop_price).submit().await.map_err(|e| e.to_string())?
        }
        "STOP_LIMIT" => {
            let stop_price = aux_price.ok_or_else(|| "Stop price required for stop-limit orders".to_string())?;
            let limit = limit_price.ok_or_else(|| "Limit price required for stop-limit orders".to_string())?;
            builder
                .stop_limit(stop_price, limit)
                .submit()
                .await
                .map_err(|e| e.to_string())?
        }
        "TRAILING_STOP" => {
            let percent = trailing_percent.ok_or_else(|| "Trailing percent required for trailing-stop orders".to_string())?;
            let stop_price = aux_price.ok_or_else(|| "Initial stop price required for trailing-stop orders".to_string())?;
            builder
                .trailing_stop(percent, stop_price)
                .submit()
                .await
                .map_err(|e| e.to_string())?
        }
        other => return Err(format!("Invalid order type: {other}")),
    };

    Ok(i32::from(order_id))
}

#[tauri::command]
pub async fn place_bracket_order(
    spec: ContractSpec,
    side: String,
    quantity: f64,
    entry_price: Option<f64>,
    take_profit: f64,
    stop_loss: f64,
    state: State<'_, AppState>,
) -> Result<BracketOrderIdsDto, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = build_contract(&spec)?;
    let account = state.selected_account.lock().await.clone();
    let builder = client.order(&contract);
    let builder = match side.to_uppercase().as_str() {
        "BUY" => builder.buy(quantity),
        "SELL" => builder.sell(quantity),
        other => return Err(format!("Invalid order side: {other}")),
    };
    let builder = match account {
        Some(account) => builder.account(account),
        None => builder,
    };

    let bracket = builder.bracket();
    let bracket = match entry_price {
        Some(price) => bracket.entry_limit(price),
        None => bracket.entry_market(),
    };

    let ids = bracket
        .take_profit(take_profit)
        .stop_loss(stop_loss)
        .submit_all()
        .await
        .map_err(|e| e.to_string())?;

    Ok(BracketOrderIdsDto {
        parent_id: i32::from(ids.parent),
        take_profit_id: i32::from(ids.take_profit),
        stop_loss_id: i32::from(ids.stop_loss),
    })
}

#[tauri::command]
pub async fn get_executions(days: i32, state: State<'_, AppState>) -> Result<Vec<ExecutionDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let filter = ExecutionFilter {
        last_n_days: days,
        ..Default::default()
    };
    let subscription = client.executions(filter).await.map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let mut executions: Vec<ExecutionDto> = Vec::new();
    let mut execution_ids: Vec<String> = Vec::new();
    let mut commissions: std::collections::HashMap<String, f64> = std::collections::HashMap::new();

    while let Some(result) = subscription.next().await {
        match result.map_err(|e| e.to_string())? {
            Executions::ExecutionData(data) => {
                execution_ids.push(data.execution.execution_id.clone());
                executions.push(ExecutionDto {
                    order_id: data.execution.order_id,
                    symbol: data.contract.symbol.to_string(),
                    security_type: data.contract.security_type.to_string(),
                    side: data.execution.side.to_string(),
                    shares: data.execution.shares,
                    price: data.execution.price,
                    time: data.execution.time.clone(),
                    exchange: data.execution.exchange.clone(),
                    commission: None,
                });
            }
            Executions::CommissionReport(report) => {
                commissions.insert(report.execution_id.clone(), report.commission);
            }
        }
    }

    for (i, exec_id) in execution_ids.iter().enumerate() {
        if let Some(commission) = commissions.get(exec_id) {
            executions[i].commission = Some(*commission);
        }
    }

    Ok(executions)
}

#[tauri::command]
pub async fn get_open_orders(state: State<'_, AppState>) -> Result<Vec<OpenOrderDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let subscription = client.open_orders().await.map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let mut orders = Vec::new();
    let mut contracts = std::collections::HashMap::new();
    while let Some(result) = subscription.next().await {
        match result.map_err(|e| e.to_string())? {
            Orders::OrderData(data) => {
                contracts.insert(data.order_id, data.contract.clone());
                orders.push(OpenOrderDto {
                    order_id: data.order_id,
                    symbol: data.contract.symbol.to_string(),
                    security_type: data.contract.security_type.to_string(),
                    action: data.order.action.to_string(),
                    order_type: data.order.order_type.clone(),
                    total_quantity: data.order.total_quantity,
                    limit_price: data.order.limit_price,
                    aux_price: data.order.aux_price,
                    status: data.order_state.status.to_string(),
                });
            }
            Orders::OrderStatus(_) => {}
        }
    }

    *state.open_order_contracts.lock().await = contracts;
    Ok(orders)
}

#[tauri::command]
pub async fn cancel_order(order_id: i32, state: State<'_, AppState>) -> Result<(), String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let subscription = client.cancel_order(order_id, "").await.map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();
    // Poll at least once — an unpolled Subscription cancels its own request on drop.
    // Full status confirmation also flows through the global order_update_stream.
    let _ = subscription.next().await;
    Ok(())
}

#[tauri::command]
pub async fn modify_order(
    order_id: i32,
    side: String,
    quantity: f64,
    order_type: String,
    limit_price: Option<f64>,
    aux_price: Option<f64>,
    trailing_percent: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = state
        .open_order_contracts
        .lock()
        .await
        .get(&order_id)
        .cloned()
        .ok_or_else(|| "Unknown order — refresh open orders first".to_string())?;

    let action = match side.to_uppercase().as_str() {
        "BUY" => Action::Buy,
        "SELL" => Action::Sell,
        other => return Err(format!("Invalid order side: {other}")),
    };

    let mut order = match order_type.to_uppercase().as_str() {
        "MARKET" => order_builder::market_order(action, quantity),
        "LIMIT" => {
            let price = limit_price.ok_or_else(|| "Limit price required".to_string())?;
            order_builder::limit_order(action, quantity, price)
        }
        "STOP" => {
            let stop_price = aux_price.ok_or_else(|| "Stop price required".to_string())?;
            order_builder::stop(action, quantity, stop_price)
        }
        "STOP_LIMIT" => {
            let stop_price = aux_price.ok_or_else(|| "Stop price required".to_string())?;
            let limit = limit_price.ok_or_else(|| "Limit price required".to_string())?;
            order_builder::stop_limit(action, quantity, limit, stop_price)
        }
        "TRAILING_STOP" => {
            let percent = trailing_percent.ok_or_else(|| "Trailing percent required".to_string())?;
            let stop_price = aux_price.ok_or_else(|| "Initial stop price required".to_string())?;
            order_builder::trailing_stop(action, quantity, percent, stop_price)
        }
        other => return Err(format!("Invalid order type: {other}")),
    };
    order.order_id = order_id;
    if let Some(account) = state.selected_account.lock().await.clone() {
        order.account = account;
    }

    client.submit_order(order_id, &contract, &order).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_positions(state: State<'_, AppState>) -> Result<Vec<PositionDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let subscription = client.positions().await.map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let mut positions = Vec::new();
    while let Some(result) = subscription.next().await {
        match result.map_err(|e| e.to_string())? {
            PositionUpdate::Position(position) => {
                let contract = &position.contract;
                let strike = if contract.strike != 0.0 { Some(contract.strike) } else { None };
                let expiry = if contract.last_trade_date_or_contract_month.is_empty() {
                    None
                } else {
                    Some(contract.last_trade_date_or_contract_month.clone())
                };
                positions.push(PositionDto {
                    account: position.account,
                    symbol: contract.symbol.to_string(),
                    local_symbol: contract.local_symbol.clone(),
                    security_type: contract.security_type.to_string(),
                    strike,
                    right: contract.right.map(|r| r.as_str().to_string()),
                    expiry,
                    exchange: contract.exchange.to_string(),
                    currency: contract.currency.to_string(),
                    position: position.position,
                    average_cost: position.average_cost,
                });
            }
            PositionUpdate::PositionEnd => break,
        }
    }
    Ok(positions)
}

#[tauri::command]
pub async fn get_account_summary(state: State<'_, AppState>) -> Result<Vec<AccountValueDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;

    let tags = &[
        AccountSummaryTags::ACCOUNT_TYPE,
        AccountSummaryTags::NET_LIQUIDATION,
        AccountSummaryTags::TOTAL_CASH_VALUE,
        AccountSummaryTags::BUYING_POWER,
        AccountSummaryTags::GROSS_POSITION_VALUE,
        AccountSummaryTags::AVAILABLE_FUNDS,
        AccountSummaryTags::EXCESS_LIQUIDITY,
        AccountSummaryTags::INIT_MARGIN_REQ,
        AccountSummaryTags::MAINT_MARGIN_REQ,
    ];

    let subscription = client
        .account_summary(&AccountGroup("All".to_string()), tags)
        .await
        .map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let mut values = Vec::new();
    while let Some(result) = subscription.next().await {
        match result.map_err(|e| e.to_string())? {
            AccountSummaryResult::Summary(summary) => {
                values.push(AccountValueDto {
                    account: summary.account,
                    tag: summary.tag,
                    value: summary.value,
                    currency: summary.currency,
                });
            }
            AccountSummaryResult::End => break,
        }
    }
    Ok(values)
}

#[tauri::command]
pub async fn get_historical_bars(
    spec: ContractSpec,
    bar_size: String,
    duration_days: i32,
    state: State<'_, AppState>,
) -> Result<Vec<BarDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = build_contract(&spec)?;
    let size = parse_bar_size(&bar_size)?;

    let data = client
        .historical_data(&contract, size)
        .what_to_show(HistoricalWhatToShow::Trades)
        .duration(duration_days.days())
        .ending(time::OffsetDateTime::now_utc())
        .fetch()
        .await
        .map_err(|e| e.to_string())?;

    Ok(data.bars.iter().map(bar_to_dto).collect())
}

#[tauri::command]
pub async fn get_option_chain(symbol: String, state: State<'_, AppState>) -> Result<OptionChainDto, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let underlying = Contract::stock(&symbol).build();
    let details = client.contract_details(&underlying).await.map_err(|e| e.to_string())?;
    let contract_id = details
        .first()
        .map(|d| d.contract.contract_id)
        .ok_or_else(|| "Underlying not found".to_string())?;

    let subscription = client
        .option_chain(&symbol, "SMART", SecurityType::Stock, contract_id)
        .await
        .map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let mut expirations: Vec<String> = Vec::new();
    let mut strikes: Vec<f64> = Vec::new();
    let mut trading_class = String::new();
    let mut multiplier = String::new();

    while let Some(result) = subscription.next().await {
        let chain = result.map_err(|e| e.to_string())?;
        if trading_class.is_empty() {
            trading_class = chain.trading_class.clone();
            multiplier = chain.multiplier.clone();
        }
        for expiration in chain.expirations {
            let formatted = format_expiration(&expiration);
            if !expirations.contains(&formatted) {
                expirations.push(formatted);
            }
        }
        for strike in chain.strikes {
            if !strikes.iter().any(|s: &f64| (s - strike).abs() < 1e-9) {
                strikes.push(strike);
            }
        }
    }
    expirations.sort();
    strikes.sort_by(|a, b| a.partial_cmp(b).unwrap());

    Ok(OptionChainDto {
        expirations,
        strikes,
        trading_class,
        multiplier,
    })
}

fn format_expiration(raw: &str) -> String {
    // IBKR returns YYYYMMDD; our ContractSpec.expiry uses YYYY-MM-DD.
    if raw.len() == 8 {
        format!("{}-{}-{}", &raw[0..4], &raw[4..6], &raw[6..8])
    } else {
        raw.to_string()
    }
}

#[tauri::command]
pub async fn get_option_snapshot(spec: ContractSpec, state: State<'_, AppState>) -> Result<OptionSnapshotDto, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = build_contract(&spec)?;

    let subscription = client
        .market_data(&contract)
        .snapshot()
        .subscribe()
        .await
        .map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let mut snapshot = OptionSnapshotDto::default();
    while let Some(item) = subscription.next().await {
        match item {
            Ok(TickTypes::Price(p)) => match p.tick_type {
                TickType::Bid => snapshot.bid = Some(p.price),
                TickType::Ask => snapshot.ask = Some(p.price),
                TickType::Last => snapshot.last = Some(p.price),
                _ => {}
            },
            Ok(TickTypes::OptionComputation(oc)) => {
                if matches!(oc.field, TickType::ModelOption) {
                    snapshot.delta = oc.delta;
                    snapshot.gamma = oc.gamma;
                    snapshot.theta = oc.theta;
                    snapshot.vega = oc.vega;
                    snapshot.implied_vol = oc.implied_volatility;
                }
            }
            Ok(TickTypes::SnapshotEnd) => break,
            Ok(_) => {}
            Err(_) => break,
        }
    }
    Ok(snapshot)
}

#[tauri::command]
pub async fn search_symbols(pattern: String, state: State<'_, AppState>) -> Result<Vec<SymbolMatchDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let matches = client.matching_symbols(&pattern).await.map_err(|e| e.to_string())?;
    Ok(matches
        .into_iter()
        .take(20)
        .map(|m| SymbolMatchDto {
            symbol: m.contract.symbol.to_string(),
            security_type: m.contract.security_type.to_string(),
            primary_exchange: m.contract.primary_exchange.to_string(),
            currency: m.contract.currency.to_string(),
        })
        .collect())
}

#[tauri::command]
pub async fn run_scanner(
    scan_code: String,
    instrument: String,
    location_code: String,
    number_of_rows: i32,
    state: State<'_, AppState>,
) -> Result<Vec<ScannerRowDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;

    let subscription_params = ScannerSubscription {
        number_of_rows: if number_of_rows > 0 { number_of_rows } else { 25 },
        instrument: Some(instrument),
        location_code: Some(location_code),
        scan_code: Some(scan_code),
        ..Default::default()
    };

    let subscription = client
        .scanner_subscription(&subscription_params, &[])
        .await
        .map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let rows = match subscription.next().await {
        Some(Ok(rows)) => rows,
        Some(Err(e)) => return Err(e.to_string()),
        None => Vec::new(),
    };

    Ok(rows
        .into_iter()
        .map(|row| ScannerRowDto {
            rank: row.rank,
            symbol: row.contract_details.contract.symbol.to_string(),
            exchange: row.contract_details.contract.exchange.to_string(),
            security_type: row.contract_details.contract.security_type.to_string(),
            long_name: row.contract_details.long_name,
        })
        .collect())
}

#[tauri::command]
pub async fn get_news(spec: ContractSpec, days: i32, state: State<'_, AppState>) -> Result<Vec<NewsArticleDto>, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let contract = build_contract(&spec)?;

    let details = client.contract_details(&contract).await.map_err(|e| e.to_string())?;
    let contract_id = details
        .first()
        .map(|d| d.contract.contract_id)
        .ok_or_else(|| "Contract not found".to_string())?;

    let providers = client.news_providers().await.map_err(|e| e.to_string())?;
    let provider_codes: Vec<&str> = providers.iter().map(|p| p.code.as_str()).collect();
    if provider_codes.is_empty() {
        return Ok(Vec::new());
    }

    let end_time = time::OffsetDateTime::now_utc();
    let start_time = end_time - time::Duration::days(days.max(1) as i64);

    let subscription = client
        .historical_news(contract_id, &provider_codes, start_time, end_time, 50)
        .await
        .map_err(|e| e.to_string())?;
    let mut subscription = subscription.filter_data();

    let mut articles = Vec::new();
    while let Some(result) = subscription.next().await {
        match result {
            Ok(article) => articles.push(NewsArticleDto {
                time: article.time.unix_timestamp(),
                provider_code: article.provider_code,
                article_id: article.article_id,
                headline: article.headline,
            }),
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(articles)
}

#[tauri::command]
pub async fn get_news_article(provider_code: String, article_id: String, state: State<'_, AppState>) -> Result<String, String> {
    let client = state.client.lock().await.clone().ok_or_else(|| "Not connected".to_string())?;
    let body = client
        .news_article(&provider_code, &article_id)
        .await
        .map_err(|e| e.to_string())?;
    match body.article_type {
        ArticleType::Text => Ok(body.article_text),
        ArticleType::Binary => Ok("[Binary/PDF article is not supported in preview]".to_string()),
    }
}

fn parse_bar_size(input: &str) -> Result<HistoricalBarSize, String> {
    match input {
        "1min" => Ok(HistoricalBarSize::Min),
        "5min" => Ok(HistoricalBarSize::Min5),
        "15min" => Ok(HistoricalBarSize::Min15),
        "1hour" => Ok(HistoricalBarSize::Hour),
        "1day" => Ok(HistoricalBarSize::Day),
        other => Err(format!("Unsupported bar size: {other}")),
    }
}

fn bar_to_dto(bar: &Bar) -> BarDto {
    BarDto {
        time: bar_timestamp_to_unix(&bar.date),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
    }
}

fn bar_timestamp_to_unix(ts: &BarTimestamp) -> i64 {
    match ts {
        BarTimestamp::Date(d) => d.midnight().assume_utc().unix_timestamp(),
        BarTimestamp::DateTime(dt) => dt.unix_timestamp(),
    }
}

fn spawn_order_update_stream(app: AppHandle, client: Arc<Client>) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let stream = match client.order_update_stream().await {
            Ok(s) => s,
            Err(e) => {
                let _ = app.emit("order-update-error", e.to_string());
                return;
            }
        };

        let mut stream = stream.filter_data();
        while let Some(update) = stream.next().await {
            match update {
                Ok(OrderUpdate::OrderStatus(status)) => {
                    let dto = OrderUpdateDto {
                        order_id: status.order_id,
                        kind: "status".to_string(),
                        status: Some(status.status.to_string()),
                        filled: Some(status.filled),
                        remaining: Some(status.remaining),
                        avg_fill_price: status.average_fill_price,
                        ..Default::default()
                    };
                    let _ = app.emit("order-update", &dto);
                }
                Ok(OrderUpdate::ExecutionData(exec)) => {
                    let dto = OrderUpdateDto {
                        order_id: exec.execution.order_id,
                        kind: "execution".to_string(),
                        symbol: Some(exec.contract.symbol.to_string()),
                        side: Some(exec.execution.side.to_string()),
                        shares: Some(exec.execution.shares),
                        price: Some(exec.execution.price),
                        ..Default::default()
                    };
                    let _ = app.emit("order-update", &dto);
                }
                Ok(OrderUpdate::CommissionReport(report)) => {
                    let dto = OrderUpdateDto {
                        kind: "commission".to_string(),
                        commission: Some(report.commission),
                        ..Default::default()
                    };
                    let _ = app.emit("order-update", &dto);
                }
                Ok(OrderUpdate::OpenOrder(_)) => {}
                Err(e) => {
                    let _ = app.emit("order-update-error", e.to_string());
                    break;
                }
            }
        }
    })
}
