import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../pages/WelcomePage.css";
import { requestDemoSession } from "../api/config";

function WelcomePage({ isLoggedIn, setIsLoggedIn }) {
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  const startDemo = async () => {
    if (demoLoading) return;
    setDemoError("");
    setDemoLoading(true);
    try {
      const token = await requestDemoSession();
      localStorage.setItem("token", token);
      if (setIsLoggedIn) setIsLoggedIn(true);
      navigate("/stats");
    } catch (err) {
      setDemoError(err.message || "Could not start the demo. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="welcome-container">
      <h1>Welcome to the Toll Management System!</h1>
      <p>View toll stations on the map, explore traffic analytics, and see ML traffic forecasts.</p>

      <div className="welcome-actions">
        <button
          type="button"
          className="welcome-button welcome-button--primary"
          onClick={startDemo}
          disabled={demoLoading}
          aria-busy={demoLoading}
        >
          {demoLoading ? "Starting demo…" : "Explore Live Demo"}
        </button>
        {isLoggedIn && (
          <Link to="/stats" className="welcome-button welcome-button--secondary">
            Continue to the App
          </Link>
        )}
      </div>

      <p className="welcome-note">
        The demo is a read-only session using a sample educational dataset. No sign-up needed.
      </p>

      {demoError && (
        <p className="welcome-error" role="alert">
          {demoError}
        </p>
      )}
    </div>
  );
}

export default WelcomePage;
