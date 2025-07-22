// Multi-provider forex service supporting free APIs
export interface ForexPrice {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: string;
  change: number;
  changePercent: number;
}

export interface CandlestickData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicator {
  timestamp: string;
  value: number;
}

type ApiProvider = 'alphavantage' | 'exchangerate' | 'currencyapi';

export class ForexService {
  private static instance: ForexService;
  private priceCache = new Map<string, ForexPrice>();
  private historicalCache = new Map<string, CandlestickData[]>();

  static getInstance(): ForexService {
    if (!ForexService.instance) {
      ForexService.instance = new ForexService();
    }
    return ForexService.instance;
  }

  private getApiKey(): string {
    const provider = this.getProvider();
    switch (provider) {
      case 'alphavantage':
        return localStorage.getItem('alphaVantageKey') || '';
      case 'exchangerate':
        return localStorage.getItem('exchangeRateKey') || '';
      case 'currencyapi':
        return localStorage.getItem('currencyApiKey') || '';
      default:
        return '';
    }
  }

  private getProvider(): ApiProvider {
    return (localStorage.getItem('forexProvider') as ApiProvider) || 'alphavantage';
  }

  private isValidApiKey(apiKey: string): boolean {
    return apiKey && apiKey.trim() !== '' && apiKey !== 'demo';
  }

  async getCurrentPrice(symbol: string): Promise<ForexPrice> {
    const provider = this.getProvider();
    const apiKey = this.getApiKey();

    console.log(`ForexService: Provider=${provider}, HasKey=${!!apiKey}, KeyLength=${apiKey?.length || 0}`);

    // Check for valid API key and provide clear console output about data source
    if (!this.isValidApiKey(apiKey)) {
      console.warn(`⚠️ WARNING: Using mock data for ${symbol} - no valid API key found for ${provider}`);
      console.info('📋 To get real-time forex data, please configure an API key in the settings');
      return this.getMockPrice(symbol);
    }

    try {
      console.log(`Fetching real data from ${provider} for ${symbol}`);
      switch (provider) {
        case 'alphavantage':
          return await this.getAlphaVantagePrice(symbol, apiKey);
        case 'exchangerate':
          return await this.getExchangeRatePrice(symbol, apiKey);
        case 'currencyapi':
          return await this.getCurrencyApiPrice(symbol, apiKey);
        default:
          throw new Error('Unknown provider');
      }
    } catch (error) {
      console.error(`Error fetching forex price from ${provider}:`, error);
      console.log('Falling back to mock data due to API error');
      return this.getMockPrice(symbol);
    }
  }

  private async getAlphaVantagePrice(symbol: string, apiKey: string): Promise<ForexPrice> {
    const fromCurrency = symbol.slice(0, 3);
    const toCurrency = symbol.slice(3, 6);
    
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${apiKey}`;
    console.log(`Alpha Vantage API call: ${url.replace(apiKey, 'HIDDEN_KEY')}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Alpha Vantage response:', data);
    
    if (data['Error Message'] || data['Information']) {
      throw new Error(data['Error Message'] || data['Information']);
    }

    const rate = data['Realtime Currency Exchange Rate'];
    if (!rate) {
      throw new Error('Invalid response format');
    }

    const price = parseFloat(rate['5. Exchange Rate']);
    const bid = parseFloat(rate['8. Bid Price']) || price - 0.0002;
    const ask = parseFloat(rate['9. Ask Price']) || price + 0.0002;

    return {
      symbol,
      price,
      bid,
      ask,
      timestamp: rate['6. Last Refreshed'],
      change: ask - bid,
      changePercent: 0
    };
  }

  private async getExchangeRatePrice(symbol: string, apiKey: string): Promise<ForexPrice> {
    const baseCurrency = symbol.slice(0, 3);
    const targetCurrency = symbol.slice(3, 6);
    
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${baseCurrency}/${targetCurrency}`;
    console.log(`ExchangeRate API call: ${url.replace(apiKey, 'HIDDEN_KEY')}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('ExchangeRate API response:', data);
    
    if (data.result !== 'success') {
      throw new Error(data['error-type'] || 'API request failed');
    }

    const price = data.conversion_rate;
    const spread = price * 0.0002; // Estimated spread

    return {
      symbol,
      price,
      bid: price - spread,
      ask: price + spread,
      timestamp: new Date(data.time_last_update_unix * 1000).toISOString(),
      change: 0,
      changePercent: 0
    };
  }

  private async getCurrencyApiPrice(symbol: string, apiKey: string): Promise<ForexPrice> {
    const baseCurrency = symbol.slice(0, 3);
    const targetCurrency = symbol.slice(3, 6);
    
    const url = `https://api.currencyapi.com/v3/latest?apikey=${apiKey}&base_currency=${baseCurrency}&currencies=${targetCurrency}`;
    console.log(`CurrencyAPI call: ${url.replace(apiKey, 'HIDDEN_KEY')}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('CurrencyAPI response:', data);
    
    if (!data.data || !data.data[targetCurrency]) {
      throw new Error('Invalid response or currency not found');
    }

    const price = data.data[targetCurrency].value;
    const spread = price * 0.0002; // Estimated spread

    return {
      symbol,
      price,
      bid: price - spread,
      ask: price + spread,
      timestamp: data.meta.last_updated_at,
      change: 0,
      changePercent: 0
    };
  }

  async getHistoricalData(symbol: string, interval: string = '1min'): Promise<CandlestickData[]> {
    const provider = this.getProvider();
    const apiKey = this.getApiKey();

    if (!this.isValidApiKey(apiKey)) {
      console.warn(`⚠️ WARNING: Using mock historical data for ${symbol} - no valid API key found for ${provider}`);
      console.info('📋 Note: Historical data is primarily available with Alpha Vantage API');
      return this.getMockHistoricalData(symbol);
    }

    try {
      switch (provider) {
        case 'alphavantage':
          return await this.getAlphaVantageHistorical(symbol, interval, apiKey);
        default:
          // Other providers typically don't offer free historical data
          console.log('Historical data not available for this provider, using mock data');
          return this.getMockHistoricalData(symbol);
      }
    } catch (error) {
      console.error(`Error fetching historical data from ${provider}:`, error);
      return this.getMockHistoricalData(symbol);
    }
  }

  private async getAlphaVantageHistorical(symbol: string, interval: string, apiKey: string): Promise<CandlestickData[]> {
    const fromSymbol = symbol.slice(0, 3);
    const toSymbol = symbol.slice(3, 6);
    
    const response = await fetch(
      `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=${fromSymbol}&to_symbol=${toSymbol}&interval=${interval}&apikey=${apiKey}`
    );
    const data = await response.json();

    if (data['Error Message'] || data['Information']) {
      throw new Error(data['Error Message'] || data['Information']);
    }

    const timeSeriesKey = `Time Series FX (${interval})`;
    const timeSeries = data[timeSeriesKey];
    
    if (!timeSeries) {
      throw new Error('No historical data available');
    }

    const candlesticks: CandlestickData[] = Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => ({
      timestamp,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'] || '0')
    })).reverse();

    this.historicalCache.set(symbol, candlesticks);
    return candlesticks;
  }

  private getMockPrice(symbol: string): ForexPrice {
    // Realistic base prices for common forex pairs (as of July 2025)
    let basePrice: number;
    switch(symbol) {
      case 'EURUSD': basePrice = 1.0850; break;
      case 'GBPUSD': basePrice = 1.2650; break;
      case 'AUDUSD': basePrice = 0.6750; break;
      case 'USDJPY': basePrice = 154.50; break;
      case 'USDCHF': basePrice = 0.9250; break;
      default: basePrice = 1.0000; break;
    }
    
    // Create small random variation to simulate market movement
    const randomVariation = (Math.random() - 0.5) * 0.01;
    const price = basePrice + randomVariation;
    
    // Typical spread for major pairs
    const spread = symbol.includes('JPY') ? 0.020 : 0.0002;
    
    return {
      symbol,
      price,
      bid: price - spread / 2,
      ask: price + spread / 2,
      timestamp: new Date().toISOString(),
      change: randomVariation,
      changePercent: (randomVariation / basePrice) * 100
    };
  }

  private getMockHistoricalData(symbol: string): CandlestickData[] {
    const data: CandlestickData[] = [];
    
    // Realistic base prices for common forex pairs (as of July 2025)
    let basePrice: number;
    switch(symbol) {
      case 'EURUSD': basePrice = 1.0850; break;
      case 'GBPUSD': basePrice = 1.2650; break;
      case 'AUDUSD': basePrice = 0.6750; break;
      case 'USDJPY': basePrice = 154.50; break;
      case 'USDCHF': basePrice = 0.9250; break;
      default: basePrice = 1.0000; break;
    }
    
    let currentPrice = basePrice;
    let trend = Math.random() > 0.5 ? 1 : -1; // Random initial trend direction
    let trendStrength = Math.random() * 0.8 + 0.2; // Random trend strength between 0.2 and 1.0
    let volatility = Math.random() * 0.003 + 0.001; // Random volatility between 0.001 and 0.004
    
    // Generate 100 candles with somewhat realistic price movement
    for (let i = 100; i >= 0; i--) {
      const timestamp = new Date(Date.now() - i * 60000).toISOString();
      
      // Occasionally change trend
      if (i % 20 === 0) {
        trend = Math.random() > 0.7 ? -trend : trend;
        trendStrength = Math.random() * 0.8 + 0.2;
        volatility = Math.random() * 0.003 + 0.001;
      }
      
      // Create a somewhat realistic price movement
      const trendMove = trend * trendStrength * (Math.random() * 0.0015);
      const randomNoise = (Math.random() - 0.5) * volatility;
      const totalMove = trendMove + randomNoise;
      
      // Generate candle data with reasonable high/low ranges
      const open = currentPrice;
      const close = open + totalMove;
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;
      
      // Volume tends to be higher during significant price movements
      const volume = Math.floor((500000 + Math.random() * 500000) * (1 + Math.abs(totalMove) * 100));
      
      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });
      
      currentPrice = close;
    }
    
    // Cache the generated data for consistency
    this.historicalCache.set(symbol, data);
    return data;
  }
}
