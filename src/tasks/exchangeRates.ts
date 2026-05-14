import { Env } from '../types';

export async function fetchExchangeRates(env: Env): Promise<void> {
  if (!env.EXCHANGE_RATE_API_KEY) {
    console.warn('[ExchangeRates] EXCHANGE_RATE_API_KEY is not set. Skipping sync.');
    return;
  }

  const baseCurrency = 'CNY';
  // Example for ExchangeRate-API
  const apiUrl = `https://v6.exchangerate-api.com/v6/${env.EXCHANGE_RATE_API_KEY}/latest/${baseCurrency}`;

  try {
    console.log(`[ExchangeRates] Fetching latest rates for base: ${baseCurrency}...`);
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(`[ExchangeRates] Failed to fetch. Status: ${response.status}`);
      const text = await response.text();
      console.error(`[ExchangeRates] Response text: ${text}`);
      return;
    }

    const data: any = await response.json();

    if (data.result === 'success' && data.conversion_rates) {
      const ratesData = {
        base: data.base_code || baseCurrency,
        rates: data.conversion_rates,
        last_updated: data.time_last_update_utc || new Date().toISOString(),
      };

      // Store in KV
      await env.KELLOGG_FRONTEND_CONFIG.put('exchangeRates', JSON.stringify(ratesData));
      console.log(`[ExchangeRates] Successfully updated exchange rates in KV. Base: ${ratesData.base}`);
    } else {
      console.error('[ExchangeRates] Invalid data format returned from API', data);
    }
  } catch (error) {
    console.error('[ExchangeRates] Error while fetching exchange rates:', error);
  }
}
