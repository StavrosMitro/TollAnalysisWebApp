import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css"; // Optional styling
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiUrl } from "../api/config";

function LoginPage({ setIsLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // Loading state
  const navigate = useNavigate();

  // Helper function for client-side validation
  const validateForm = () => {
    if (!email) {
      toast.error("Please enter your email.");
      return false;
    }
    // Simple email regex for validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email.");
      return false;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return false;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateForm()) return; // Perform client-side validation

    setLoading(true); // Start loading
    try {
      // Make a POST request to the /api/login endpoint
      const response = await fetch(apiUrl("/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_email: email,
          user_password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store the token securely
        localStorage.setItem("token", data.token);

        // Update the parent state (if you’re using a parent App component)
        setIsLoggedIn(true);

        toast.success("Login successful!");
        // Redirect to a protected page (e.g., home/dashboard)
        navigate("/");
      } else {
        // Handle specific server-side errors
        switch (response.status) {
          case 400:
            toast.error(data.error || "Invalid request. Please try again.");
            break;
          case 401:
            toast.error(data.error || "Unauthorized access. Check your credentials.");
            break;
          case 403:
            toast.error(data.error || "You do not have permission to access this section.");
            break;
          case 404:
            toast.error(data.error || "User not found.");
            break;
          case 500:
            toast.error(data.error || "Server error. Please try again later.");
            break;
          default:
            toast.error(data.error || "An error occurred during login.");
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred while logging in. Please try again.");
    } finally {
      setLoading(false); // End loading
    }
  };

  return (
    <div className="login-page">
      <h2>Welcome to the TollAnalysis Service</h2>
      <form onSubmit={handleLogin} className="login-form">
        <div className="input-group">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="input-group">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <button type="submit" className="login-button" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar />
    </div>
  );
}

export default LoginPage;
