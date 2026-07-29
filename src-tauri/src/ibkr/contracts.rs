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
