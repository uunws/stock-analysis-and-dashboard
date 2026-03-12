import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const TYPHOON_API_KEY = import.meta.env.VITE_TYPHOON_API_KEY;

export default function StockDetail() {
  const { ticker } = useParams();
  const navigate = useNavigate();

  const [stockData, setStockData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [news, setNews] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [analystTrend, setAnalystTrend] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("1mo");

  const [aiSentiment, setAiSentiment] = useState({
    signal: "Analyzing...",
    color: "#888",
  });
  const [typhoonSentiment, setTyphoonSentiment] = useState({
    signal: "Analyzing...",
    color: "#888",
  });

  const rangeConfig = {
    "1d": { range: "1d", interval: "5m" },
    "1mo": { range: "1mo", interval: "1d" },
    "1y": { range: "1y", interval: "1d" },
  };

  useEffect(() => {
    const fetchChartData = async () => {
      setIsLoading(true);
      try {
        const { range, interval } = rangeConfig[timeRange];
        const stockRes = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`,
        );
        if (!stockRes.ok) throw new Error("Ticker not found");
        const stockJson = await stockRes.json();
        const result = stockJson.chart.result[0];
        setStockData(result.meta);

        const timestamps = result.timestamp;
        const closePrices = result.indicators.quote[0].close;
        if (timestamps && closePrices) {
          const formattedChartData = timestamps.map((time, index) => {
            const date = new Date(time * 10000);
            let formattedLabel = "";
            if (timeRange === "1d") {
              formattedLabel = date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
            } else {
              formattedLabel = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)}`;
            }
            return { date: formattedLabel, price: closePrices[index] };
          });
          setChartData(
            formattedChartData.filter((item) => item.price !== null),
          );
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
      }
      setIsLoading(false);
    };

    fetchChartData();
  }, [ticker, timeRange]);

  useEffect(() => {
    const fetchMetaAndNews = async () => {
      if (!FINNHUB_API_KEY) return;

      try {
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        const formatDate = (date) => date.toISOString().split("T")[0];
        const toDate = formatDate(today);
        const fromDate = formatDate(lastWeek);

        const newsPromise = fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`,
        );
        const trendPromise = fetch(
          `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${FINNHUB_API_KEY}`,
        );
        const profilePromise = fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`,
        );

        const [newsRes, trendRes, profileRes] = await Promise.all([
          newsPromise,
          trendPromise,
          profilePromise,
        ]);

        if (trendRes.ok) {
          const trendData = await trendRes.json();
          if (trendData.length > 0) setAnalystTrend(trendData[0]);
        }

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData && profileData.name) setCompanyName(profileData.name);
        }

        if (newsRes.ok) {
          const newsData = await newsRes.json();
          const topNews = newsData.slice(0, 5);
          setNews(topNews);

          if (topNews.length > 0) {
            analyzeWithGemini(topNews);
            analyzeWithTyphoon(topNews);
          } else {
            setAiSentiment({ signal: "NO NEWS", color: "#888" });
            setTyphoonSentiment({ signal: "NO NEWS", color: "#888" });
          }
        }
      } catch (error) {
        console.error("Error fetching background data:", error);
      }
    };

    const generateSmartPrompt = (headlines) => {
      return `You are a senior quantitative analyst at a top Wall Street hedge fund. Analyze these recent news headlines for ${ticker}: "${headlines}". 
      Instructions: 
      1. Ignore journalistic fluff and clickbait. 
      2. Focus strictly on material business impacts (e.g., earnings reports, legal issues, leadership changes, macroeconomic shifts). 
      3. Evaluate if the underlying financial reality of these events will drive the stock price up or down.
      Reply strictly with EXACTLY ONE WORD from this list: BULLISH, BEARISH, or NEUTRAL. Do not include any punctuation or explanations.`;
    };

    const analyzeWithGemini = async (topNews) => {
      try {
        const headlines = topNews.map((n) => n.headline).join(". ");
        const prompt = generateSmartPrompt(headlines);

        const llmRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          },
        );
        const llmData = await llmRes.json();

        if (!llmRes.ok) {
          setAiSentiment({ signal: "API ERROR", color: "#ff453a" });
        } else if (llmData.candidates && llmData.candidates.length > 0) {
          const answer = llmData.candidates[0].content.parts[0].text
            .trim()
            .toUpperCase();
          if (answer.includes("BULLISH"))
            setAiSentiment({ signal: "BULLISH", color: "#30d158" });
          else if (answer.includes("BEARISH"))
            setAiSentiment({ signal: "BEARISH", color: "#ff453a" });
          else setAiSentiment({ signal: "NEUTRAL", color: "#f5d700" });
        }
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        setAiSentiment({ signal: "ERROR", color: "#888" });
      }
    };

    const analyzeWithTyphoon = async (topNews) => {
      try {
        const headlines = topNews.map((n) => n.headline).join(". ");

        const systemPrompt = `You are a senior quantitative analyst at a top Wall Street hedge fund. 
        Instructions: 
        1. Ignore journalistic fluff and clickbait. 
        2. Focus strictly on material business impacts. 
        3. Evaluate if the underlying financial reality will drive the stock price up or down.
        Reply strictly with EXACTLY ONE WORD from this list: BULLISH, BEARISH, or NEUTRAL. Do not include any punctuation or explanations.`;

        const userPrompt = `Analyze these recent news headlines for ${ticker}: "${headlines}"`;

        const response = await fetch(
          "https://api.opentyphoon.ai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${TYPHOON_API_KEY}`,
            },
            body: JSON.stringify({
              model: "typhoon-v2.5-30b-a3b-instruct",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.1,
              max_tokens: 500,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          // เพิ่มการ Log Error แบบละเอียดลง Console เพื่อให้รู้สาเหตุที่แท้จริง
          console.error("Typhoon API Error Details:", data);
          setTyphoonSentiment({ signal: "API ERROR", color: "#ff453a" });
        } else if (data.choices && data.choices.length > 0) {
          const answer = data.choices[0].message.content.trim().toUpperCase();
          if (answer.includes("BULLISH"))
            setTyphoonSentiment({ signal: "BULLISH", color: "#30d158" });
          else if (answer.includes("BEARISH"))
            setTyphoonSentiment({ signal: "BEARISH", color: "#ff453a" });
          else setTyphoonSentiment({ signal: "NEUTRAL", color: "#f5d700" });
        }
      } catch (err) {
        console.error("Typhoon Fetch Error:", err);
        setTyphoonSentiment({ signal: "ERROR", color: "#888" });
      }
    };

    setAiSentiment({ signal: "Analyzing...", color: "#888" });
    setTyphoonSentiment({ signal: "Analyzing...", color: "#888" });
    fetchMetaAndNews();
  }, [ticker]);

  if (isLoading && !stockData)
    return <p style={{ textAlign: "center" }}>Loading {ticker} details...</p>;
  if (!stockData)
    return (
      <p style={{ textAlign: "center", color: "red" }}>
        Could not find data for {ticker}
      </p>
    );

  const change = stockData.regularMarketPrice - stockData.chartPreviousClose;
  const isPositive = change >= 0;
  const color = isPositive ? "#30d158" : "#ff453a";

  const getButtonStyle = (range) => ({
    padding: "6px 16px",
    borderRadius: "20px",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    background: timeRange === range ? "#333" : "transparent",
    color: timeRange === range ? "white" : "#888",
    transition: "all 0.2s",
  });

  const getTopRecommendation = () => {
    if (!analystTrend) return { text: "No Data", color: "#888" };
    const { strongBuy, buy, hold, sell, strongSell } = analystTrend;
    const totalBuy = strongBuy + buy;
    const totalSell = strongSell + sell;

    if (totalBuy > hold && totalBuy > totalSell) {
      return { text: `BUY (${totalBuy} vs ${totalSell})`, color: "#30d158" };
    }
    if (totalSell > hold && totalSell > totalBuy) {
      return { text: `SELL (${totalSell} vs ${totalBuy})`, color: "#ff453a" };
    }
    return { text: `HOLD (${hold} holds)`, color: "#f5d700" };
  };

  const currentRecommendation = getTopRecommendation();

  return (
    <div className="stock-detail-full-width">
      <button
        onClick={() => navigate("/")}
        style={{
          marginBottom: "20px",
          padding: "8px 12px",
          borderRadius: "8px",
          background: "#333",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        ← Back to Portfolio
      </button>

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "36px", margin: "0" }}>{ticker}</h2>
        {companyName && (
          <div style={{ fontSize: "16px", color: "#888", marginTop: "4px" }}>
            {companyName}
          </div>
        )}
        <div style={{ fontSize: "42px", fontWeight: "bold", margin: "10px 0" }}>
          ${stockData.regularMarketPrice.toFixed(2)}
        </div>
        <div style={{ fontSize: "18px", color: color }}>
          {isPositive ? "+" : ""}
          {change.toFixed(2)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <button style={getButtonStyle("1d")} onClick={() => setTimeRange("1d")}>
          1D
        </button>
        <button
          style={getButtonStyle("1mo")}
          onClick={() => setTimeRange("1mo")}
        >
          1M
        </button>
        <button style={getButtonStyle("1y")} onClick={() => setTimeRange("1y")}>
          1Y
        </button>
      </div>

      <div style={{ height: "300px", width: "100%", marginBottom: "40px" }}>
        {isLoading ? (
          <p
            style={{ textAlign: "center", color: "#888", paddingTop: "120px" }}
          >
            Loading chart...
          </p>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c1e",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                itemStyle={{ color: color, fontWeight: "bold" }}
                formatter={(value) => [`$${value.toFixed(2)}`, "Price"]}
                labelStyle={{ color: "#888", marginBottom: "5px" }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                fillOpacity={1}
                fill="url(#colorPrice)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: "center", color: "#888" }}>
            Chart data unavailable
          </p>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          borderTop: "1px solid #333",
          paddingTop: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "15px",
          }}
        >
          <div>
            <span style={{ color: "#888" }}>Prev Close</span>
            <div style={{ fontSize: "18px", fontWeight: "bold" }}>
              ${stockData.chartPreviousClose?.toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ color: "#888" }}>Day High</span>
            <div style={{ fontSize: "18px", fontWeight: "bold" }}>
              ${stockData.regularMarketDayHigh?.toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ color: "#888" }}>Day Low</span>
            <div style={{ fontSize: "18px", fontWeight: "bold" }}>
              ${stockData.regularMarketDayLow?.toFixed(2)}
            </div>
          </div>
          <div>
            <span style={{ color: "#888" }}>Volume</span>
            <div style={{ fontSize: "18px", fontWeight: "bold" }}>
              {stockData.regularMarketVolume?.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="news-section">
          <h3
            style={{
              borderBottom: "1px solid #333",
              paddingBottom: "10px",
              margin: "0 0 15px 0",
            }}
          >
            Latest News
          </h3>
          {news.length > 0 ? (
            news.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="news-item"
                style={{ marginBottom: "15px" }}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#007bff",
                    textDecoration: "none",
                    fontWeight: "bold",
                  }}
                >
                  {item.headline}
                </a>
                {item.summary && (
                  <p
                    style={{
                      color: "#888",
                      fontSize: "14px",
                      margin: "5px 0 0 0",
                    }}
                  >
                    {item.summary.substring(0, 100)}...
                  </p>
                )}
              </div>
            ))
          ) : (
            <p style={{ color: "#888" }}>No news found for {ticker}</p>
          )}
        </div>
      </div>

      <div
        className="profile-section"
        style={{
          marginTop: "40px",
          borderTop: "1px solid #333",
          paddingTop: "20px",
          paddingBottom: "40px",
        }}
      >
        <h3 style={{ marginBottom: "20px" }}>AI Analysis</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            alignItems: "center",
            width: "100%",
            gap: "10px",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                color: "#888",
                fontSize: "14px",
                textTransform: "uppercase",
              }}
            >
              Watched:
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                textTransform: "uppercase",
                marginTop: "4px",
              }}
            >
              {ticker}
            </div>
          </div>

          <div
            style={{
              textAlign: "left",
              borderLeft: "1px solid #333",
              paddingLeft: "20px",
            }}
          >
            <div
              style={{
                color: "#888",
                fontSize: "14px",
                textTransform: "uppercase",
              }}
            >
              Wall St Analysis
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: currentRecommendation.color,
                marginTop: "4px",
              }}
            >
              {currentRecommendation.text}
            </div>
            {analystTrend && (
              <div
                style={{ color: "#888", fontSize: "12px", marginTop: "4px" }}
              >
                Based on{" "}
                {analystTrend.buy +
                  analystTrend.strongBuy +
                  analystTrend.hold +
                  analystTrend.sell +
                  analystTrend.strongSell}{" "}
                analysts
              </div>
            )}
          </div>

          <div
            style={{
              textAlign: "left",
              borderLeft: "1px solid #333",
              paddingLeft: "20px",
            }}
          >
            <div
              style={{
                color: "#888",
                fontSize: "14px",
                textTransform: "uppercase",
              }}
            >
              Gemini 2.5
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: aiSentiment.color,
                marginTop: "4px",
              }}
            >
              {aiSentiment.signal}
            </div>
          </div>

          <div
            style={{
              textAlign: "left",
              borderLeft: "1px solid #333",
              paddingLeft: "20px",
            }}
          >
            <div
              style={{
                color: "#888",
                fontSize: "14px",
                textTransform: "uppercase",
              }}
            >
              Typhoon 2.5
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: typhoonSentiment.color,
                marginTop: "4px",
              }}
            >
              {typhoonSentiment.signal}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
