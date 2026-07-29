use ibapi::prelude::*;
use serde::Deserialize;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum AssetType {
    Stock,
    Option,
    Future,
    Forex,
    Crypto,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContractSpec {
    pub asset_type: AssetType,
    pub symbol: String,
    pub right: Option<String>,
    pub strike: Option<f64>,
    pub expiry: Option<String>,
    pub contract_month: Option<String>,
    pub quote_currency: Option<String>,
}

pub fn build_contract(spec: &ContractSpec) -> Result<Contract, String> {
    match spec.asset_type {
        AssetType::Stock => Ok(Contract::stock(&spec.symbol).build()),
        AssetType::Option => {
            let right = spec.right.as_deref().ok_or_else(|| "Option right (CALL/PUT) required".to_string())?;
            let strike = spec.strike.ok_or_else(|| "Option strike required".to_string())?;
            let expiry = spec.expiry.as_deref().ok_or_else(|| "Option expiry required".to_string())?;
            let (year, month, day) = parse_ymd(expiry)?;
            let contract = match right.to_uppercase().as_str() {
                "CALL" => Contract::call(&spec.symbol).strike(strike).expires_on(year, month, day).build(),
                "PUT" => Contract::put(&spec.symbol).strike(strike).expires_on(year, month, day).build(),
                other => return Err(format!("Invalid option right: {other}")),
            };
            Ok(contract)
        }
        AssetType::Future => {
            let builder = Contract::futures(&spec.symbol);
            let contract = if let Some(cm) = &spec.contract_month {
                let (year, month) = parse_ym(cm)?;
                builder.expires_in(ContractMonth::new(year, month)).build()
            } else {
                builder.front_month().build()
            };
            Ok(contract)
        }
        AssetType::Forex => {
            let quote = spec.quote_currency.as_deref().ok_or_else(|| "Forex quote currency required".to_string())?;
            Ok(Contract::forex(&spec.symbol, quote).build())
        }
        AssetType::Crypto => Ok(Contract::crypto(&spec.symbol).build()),
    }
}

fn parse_ymd(date: &str) -> Result<(u16, u8, u8), String> {
    let parts: Vec<&str> = date.split('-').collect();
    let [y, m, d] = parts.as_slice() else {
        return Err(format!("Invalid date '{date}', expected YYYY-MM-DD"));
    };
    let year = y.parse::<u16>().map_err(|_| format!("Invalid year in '{date}'"))?;
    let month = m.parse::<u8>().map_err(|_| format!("Invalid month in '{date}'"))?;
    let day = d.parse::<u8>().map_err(|_| format!("Invalid day in '{date}'"))?;
    Ok((year, month, day))
}

fn parse_ym(date: &str) -> Result<(u16, u8), String> {
    let parts: Vec<&str> = date.split('-').collect();
    let [y, m] = parts.as_slice() else {
        return Err(format!("Invalid month '{date}', expected YYYY-MM"));
    };
    let year = y.parse::<u16>().map_err(|_| format!("Invalid year in '{date}'"))?;
    let month = m.parse::<u8>().map_err(|_| format!("Invalid month in '{date}'"))?;
    Ok((year, month))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stock_spec(symbol: &str) -> ContractSpec {
        ContractSpec {
            asset_type: AssetType::Stock,
            symbol: symbol.to_string(),
            right: None,
            strike: None,
            expiry: None,
            contract_month: None,
            quote_currency: None,
        }
    }

    #[test]
    fn parse_ymd_valid() {
        assert_eq!(parse_ymd("2024-12-20").unwrap(), (2024, 12, 20));
    }

    #[test]
    fn parse_ymd_rejects_wrong_part_count() {
        assert!(parse_ymd("2024-12").is_err());
        assert!(parse_ymd("2024-12-20-01").is_err());
    }

    #[test]
    fn parse_ymd_rejects_non_numeric() {
        assert!(parse_ymd("abcd-12-20").is_err());
        assert!(parse_ymd("2024-xx-20").is_err());
        assert!(parse_ymd("2024-12-xx").is_err());
    }

    #[test]
    fn parse_ym_valid() {
        assert_eq!(parse_ym("2024-12").unwrap(), (2024, 12));
    }

    #[test]
    fn parse_ym_rejects_wrong_part_count() {
        assert!(parse_ym("2024-12-20").is_err());
        assert!(parse_ym("2024").is_err());
    }

    #[test]
    fn parse_ym_rejects_non_numeric() {
        assert!(parse_ym("2024-xx").is_err());
    }

    #[test]
    fn build_stock_contract() {
        let contract = build_contract(&stock_spec("AAPL")).unwrap();
        assert_eq!(contract.symbol.as_str(), "AAPL");
        assert_eq!(contract.security_type, SecurityType::Stock);
    }

    #[test]
    fn build_call_option_contract() {
        let spec = ContractSpec {
            asset_type: AssetType::Option,
            symbol: "AAPL".to_string(),
            right: Some("CALL".to_string()),
            strike: Some(150.0),
            expiry: Some("2024-12-20".to_string()),
            contract_month: None,
            quote_currency: None,
        };
        let contract = build_contract(&spec).unwrap();
        assert_eq!(contract.symbol.as_str(), "AAPL");
        assert_eq!(contract.security_type, SecurityType::Option);
        assert_eq!(contract.right, Some(OptionRight::Call));
        assert_eq!(contract.strike, 150.0);
        assert_eq!(contract.last_trade_date_or_contract_month, "20241220");
    }

    #[test]
    fn build_put_option_contract() {
        let spec = ContractSpec {
            asset_type: AssetType::Option,
            symbol: "SPY".to_string(),
            right: Some("put".to_string()),
            strike: Some(450.0),
            expiry: Some("2024-06-21".to_string()),
            contract_month: None,
            quote_currency: None,
        };
        let contract = build_contract(&spec).unwrap();
        assert_eq!(contract.right, Some(OptionRight::Put));
        assert_eq!(contract.last_trade_date_or_contract_month, "20240621");
    }

    #[test]
    fn build_option_missing_right_errors() {
        let spec = ContractSpec {
            asset_type: AssetType::Option,
            symbol: "AAPL".to_string(),
            right: None,
            strike: Some(150.0),
            expiry: Some("2024-12-20".to_string()),
            contract_month: None,
            quote_currency: None,
        };
        assert!(build_contract(&spec).is_err());
    }

    #[test]
    fn build_option_missing_strike_errors() {
        let spec = ContractSpec {
            asset_type: AssetType::Option,
            symbol: "AAPL".to_string(),
            right: Some("CALL".to_string()),
            strike: None,
            expiry: Some("2024-12-20".to_string()),
            contract_month: None,
            quote_currency: None,
        };
        assert!(build_contract(&spec).is_err());
    }

    #[test]
    fn build_option_missing_expiry_errors() {
        let spec = ContractSpec {
            asset_type: AssetType::Option,
            symbol: "AAPL".to_string(),
            right: Some("CALL".to_string()),
            strike: Some(150.0),
            expiry: None,
            contract_month: None,
            quote_currency: None,
        };
        assert!(build_contract(&spec).is_err());
    }

    #[test]
    fn build_option_invalid_right_errors() {
        let spec = ContractSpec {
            asset_type: AssetType::Option,
            symbol: "AAPL".to_string(),
            right: Some("STRADDLE".to_string()),
            strike: Some(150.0),
            expiry: Some("2024-12-20".to_string()),
            contract_month: None,
            quote_currency: None,
        };
        assert!(build_contract(&spec).is_err());
    }

    #[test]
    fn build_future_with_contract_month() {
        let spec = ContractSpec {
            asset_type: AssetType::Future,
            symbol: "ES".to_string(),
            right: None,
            strike: None,
            expiry: None,
            contract_month: Some("2024-12".to_string()),
            quote_currency: None,
        };
        let contract = build_contract(&spec).unwrap();
        assert_eq!(contract.security_type, SecurityType::Future);
        assert_eq!(contract.last_trade_date_or_contract_month, "202412");
    }

    #[test]
    fn build_future_front_month_when_unspecified() {
        let spec = ContractSpec {
            asset_type: AssetType::Future,
            symbol: "ES".to_string(),
            right: None,
            strike: None,
            expiry: None,
            contract_month: None,
            quote_currency: None,
        };
        let contract = build_contract(&spec).unwrap();
        assert_eq!(contract.security_type, SecurityType::Future);
        assert!(!contract.last_trade_date_or_contract_month.is_empty());
    }

    #[test]
    fn build_forex_contract() {
        let spec = ContractSpec {
            asset_type: AssetType::Forex,
            symbol: "EUR".to_string(),
            right: None,
            strike: None,
            expiry: None,
            contract_month: None,
            quote_currency: Some("USD".to_string()),
        };
        let contract = build_contract(&spec).unwrap();
        assert_eq!(contract.security_type, SecurityType::ForexPair);
    }

    #[test]
    fn build_forex_missing_quote_currency_errors() {
        let spec = ContractSpec {
            asset_type: AssetType::Forex,
            symbol: "EUR".to_string(),
            right: None,
            strike: None,
            expiry: None,
            contract_month: None,
            quote_currency: None,
        };
        assert!(build_contract(&spec).is_err());
    }

    #[test]
    fn build_crypto_contract() {
        let contract = build_contract(&ContractSpec {
            asset_type: AssetType::Crypto,
            symbol: "BTC".to_string(),
            right: None,
            strike: None,
            expiry: None,
            contract_month: None,
            quote_currency: None,
        })
        .unwrap();
        assert_eq!(contract.security_type, SecurityType::Crypto);
        assert_eq!(contract.symbol.as_str(), "BTC");
    }
}
