import { useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import StockList from "./components/StockList";
import StockDetail from "./components/StockDetail";
import "./App.css";

function App() {
  const [searchInput, setSearchInput] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/stock/${searchInput.toUpperCase().trim()}`);
      setSearchInput("");
    }
  };

  const isDetailPage = location.pathname.startsWith("/stock/");

  return (
    <div
      className={
        isDetailPage ? "app-container app-container-wide" : "app-container"
      }
    >
      <h1>My Stock Dashboard</h1>

      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "30px",
          width: "100%",
          maxWidth: "500px",
        }}
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search ticker (e.g., SPOT)..."
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid #333",
            background: "#1c1c1e",
            color: "white",
            textTransform: "uppercase",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0 20px",
            borderRadius: "10px",
            background: "#007bff",
            color: "white",
            border: "none",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </form>

      <div className="card">
        <Routes>
          <Route path="/" element={<StockList />} />
          <Route path="/stock/:ticker" element={<StockDetail />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
