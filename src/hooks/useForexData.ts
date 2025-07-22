
import { useQuery } from '@tanstack/react-query';
import { ForexService, ForexPrice, CandlestickData } from '../services/forexService';

export const useForexPrice = (symbol: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['forex-price', symbol],
    queryFn: () => ForexService.getInstance().getCurrentPrice(symbol),
    refetchInterval: 5000, // Refetch every 5 seconds
    enabled,
    staleTime: 1000, // Consider data stale after 1 second
  });
};

export const useHistoricalData = (symbol: string, interval: string = '1min') => {
  return useQuery({
    queryKey: ['forex-historical', symbol, interval],
    queryFn: () => ForexService.getInstance().getHistoricalData(symbol, interval),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};
