import { useState, useEffect } from "react";
import SlackMock from "./SlackMock";
import DashboardMock from "./DashboardMock";

const ProductPreview = () => {
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setShowDashboard((p) => !p), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Amber glow behind */}
      <div className="absolute -inset-4 bg-primary/5 rounded-2xl blur-2xl pointer-events-none" />
      <div className="relative">
        <div
          className="transition-opacity duration-700 ease-in-out"
          style={{ opacity: showDashboard ? 0 : 1, position: showDashboard ? "absolute" : "relative", inset: 0 }}
        >
          <SlackMock />
        </div>
        <div
          className="transition-opacity duration-700 ease-in-out"
          style={{ opacity: showDashboard ? 1 : 0, position: showDashboard ? "relative" : "absolute", inset: 0 }}
        >
          <DashboardMock />
        </div>
      </div>
    </div>
  );
};

export default ProductPreview;
