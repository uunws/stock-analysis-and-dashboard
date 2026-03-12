import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const myTickers = [
  "NVDA",
  "MSFT",
  "GOOG",
  "AMZN",
  "AMD",
  "AAPL",
  "TSLA",
  "META",
  "NFLX",
];

export default function StockList() {
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllPrices = async () => {
      try {
        const fetchPromises = myTickers.map(async (ticker) => {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
          );
          if (!res.ok) throw new Error(`Failed to fetch`);
          const data = await res.json();
          const meta = data.chart.result[0].meta;

          const change = meta.regularMarketPrice - meta.chartPreviousClose;
          return {
            ticker,
            price: meta.regularMarketPrice,
            change,
            percentChange: (change / meta.chartPreviousClose) * 100,
          };
        });

        const realStockData = await Promise.all(fetchPromises);
        setStocks(realStockData);
        setIsLoading(false);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (error) {
        console.error("Error fetching list:", error);
        setIsLoading(false);
      }
    };

    fetchAllPrices();
    const intervalId = setInterval(fetchAllPrices, 10000);
    return () => clearInterval(intervalId);
  }, []);

  if (isLoading)
    return <p style={{ textAlign: "center" }}>Loading live prices...</p>;

  return (
    <>
      <div className="last-updated">Last Updated: {lastUpdated}</div>
      {stocks.map((stock) => {
        const isPositive = stock.change >= 0;
        const color = isPositive ? "#30d158" : "#ff453a";
        const sign = isPositive ? "+" : "";

        return (
          <div
            key={stock.ticker}
            className="stock-row"
            onClick={() => navigate(`/stock/${stock.ticker}`)}
          >
            <div className="stock-ticker">{stock.ticker}</div>
            <div className="stock-price-container">
              <div className="stock-price">${stock.price.toFixed(2)}</div>
              <div className="stock-change" style={{ color: color }}>
                {sign}
                {stock.change.toFixed(2)} ({sign}
                {stock.percentChange.toFixed(2)}%)
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
