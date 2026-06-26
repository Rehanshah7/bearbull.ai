import YahooFinance from 'yahoo-finance2';

// Instantiate the YahooFinance client with notice suppressions
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical']
});

export class StockService {
  /**
   * Retrieves real-time quote details, 5-year daily historical metrics, and news for a given ticker.
   */
  static async getStockData(ticker: string, intradayInterval: string = '15m') {
    const uppercaseTicker = ticker.toUpperCase();
    const period1Historical = new Date();
    period1Historical.setFullYear(period1Historical.getFullYear() - 10);

    // Yahoo Finance has constraints on intraday data retention:
    // - 1m interval is only available for the last 7 days (usually last 1-2 days are most reliable)
    // - 2m/5m/15m/30m/90m are available for the last 60 days
    // - 1h/60m/90m are available for the last 730 days
    let daysToFetch = 7;
    if (intradayInterval === '1m') {
      daysToFetch = 2;
    } else if (intradayInterval === '5m') {
      daysToFetch = 5;
    } else if (intradayInterval === '1h') {
      daysToFetch = 30;
    }

    const intradayPeriod1 = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000);

    // Fetch quote, 10-year historical data, custom interval intraday data, and search news in parallel.
    const [quote, historicalRaw, chartRaw, searchResults] = await Promise.all([
      yahooFinance.quote(uppercaseTicker),
      yahooFinance.historical(uppercaseTicker, {
        period1: period1Historical,
        period2: new Date(),
        interval: '1d'
      }),
      yahooFinance.chart(uppercaseTicker, {
        period1: intradayPeriod1,
        period2: new Date(),
        interval: intradayInterval as any
      }).catch((err) => {
        console.error(`Yahoo Finance chart fetch failed for interval ${intradayInterval}:`, err);
        return null;
      }),
      yahooFinance.search(uppercaseTicker).catch(() => ({ news: [] }))
    ]);

    if (!quote) {
      throw new Error(`Stock symbol "${uppercaseTicker}" not found`);
    }

    return {
      quote,
      historical: historicalRaw,
      intraday: chartRaw?.quotes || [],
      news: searchResults.news || []
    };
  }

  /**
   * Retrieves quotes for multiple tickers in a single call.
   */
  static async getMultipleQuotes(tickers: string[]) {
    if (!tickers || tickers.length === 0) {
      return [];
    }
    try {
      const quotes = await yahooFinance.quote(tickers);
      return Array.isArray(quotes) ? quotes : [quotes];
    } catch (err) {
      console.error("Batch quote fetch failed, falling back to individual calls", err);
      const results = await Promise.all(
        tickers.map(async (t) => {
          try {
            return await yahooFinance.quote(t);
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean);
    }
  }

  /**
   * Searches for stock ticker suggestions based on a query string.
   */
  static async searchStocks(query: string) {
    if (!query || !query.trim()) {
      return [];
    }
    const result = await yahooFinance.search(query);
    // Map to normalized structure
    return (result.quotes || []).map((q: any) => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      exchDisp: q.exchDisp || q.exchange,
      typeDisp: q.typeDisp || q.quoteType
    }));
  }
}
