import yahooFinance from 'yahoo-finance2';

export interface StockQuote {
  symbol: string;
  longName?: string;
  shortName?: string;
  fullExchangeName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
  regularMarketDayLow?: number;
  regularMarketDayHigh?: number;
  regularMarketVolume?: number;
  trailingPE?: number;
  forwardPE?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export interface HistoricalResultItem {
  [key: string]: any;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: number;
}

export interface StockApiResponse {
  success: boolean;
  data?: {
    quote: StockQuote;
    historical: HistoricalResultItem[];
    intraday?: any[];
    news?: any[];
    aiInsights?: any;
  };
  error?: string;
}

export interface AuthApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
