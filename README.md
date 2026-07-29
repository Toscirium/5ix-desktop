# 5ix

A fast, native desktop trading terminal for Interactive Brokers — built with Rust (Tauri) and React, not Java. Connects to IBKR via the TWS API through IB Gateway or TWS itself.

## Features

- Live multi-asset watchlists (stocks, options, futures, forex, crypto) with symbol autocomplete, organized into multiple named tabs
- Order ticket: market/limit/stop/stop-limit/trailing-stop orders, plus VWAP/TWAP algo orders, with a confirmation dialog and a large-order sanity check
- Options chain viewer with live bid/ask/delta
- Positions, account summary, and live account P&L (daily/unrealized/realized)
- Open orders panel with inline modify/cancel
- Market scanner, news headlines, and a persistent activity/error log
- Auto-reconnect on dropped connections
- Light/dark theme, resizable panels, keyboard shortcuts
- Built-in auto-updater

## Prerequisites

- [IB Gateway](https://www.interactivebrokers.com/en/trading/ibgateway-stable.php) or TWS running locally, with API connections enabled (Configure → Settings → API → Settings → enable socket clients, add `127.0.0.1` as a trusted IP). Default ports: `4001` live, `4002` paper.
- Node.js and Rust (stable toolchain via [rustup](https://rustup.rs/)).
- Linux only: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `xdg-utils`.

## Development

```bash
npm install
npm run tauri dev
```

## Testing

```bash
npm run test               # frontend unit tests (vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit tests
```

## Building installers

```bash
npm run tauri build
```

Produces platform-native installers (`.deb`/`.rpm`/`.AppImage` on Linux, `.msi`/`.exe` on Windows, `.dmg`/`.app` on macOS) under `src-tauri/target/release/bundle/`.

Cross-platform builds are also wired up via `.github/workflows/release.yml`, which builds real installers on GitHub's native Windows/macOS/Linux runners (push to the `release` branch to trigger). For signed auto-updates to work from that workflow, set two repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY` — contents of the updater signing private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the key's password (blank if none)

and update the `plugins.updater.endpoints` URL in `src-tauri/tauri.conf.json` to point at this repo's releases.

## Tech stack

- **Backend:** Rust, Tauri 2, [`ibapi`](https://github.com/wboayue/rust-ibapi) (TWS API client)
- **Frontend:** React, TypeScript, Vite, [lightweight-charts](https://github.com/tradingview/lightweight-charts)
