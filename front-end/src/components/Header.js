import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import './Header.css';
import { apiUrl } from '../api/config';

function Header({ isLoggedIn, setIsLoggedIn }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      alert('No token found. You are already logged out.');
      setIsLoggedIn(false);
      navigate('/');
      return;
    }

    try {
      const response = await fetch(apiUrl('/logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-observatory-auth': token,
        },
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        alert('You have been logged out.');
        navigate('/');
      } else {
        alert(data.error || 'Logout failed. Please try again.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('An error occurred during logout. Please try again.');
    }
  };

  return (
    <header className="header">
      <h1 className="header-title">TollAnalysis</h1>
      <nav className="header-nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : 'inactive')}>
          Αρχική
        </NavLink>
        <NavLink to="/map" className={({ isActive }) => (isActive ? 'active' : 'inactive')}>
          Χάρτης
        </NavLink>

        {isLoggedIn && (
          <>
            <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : 'inactive')}>
              Στατιστικά
            </NavLink>
            <NavLink to="/debts" className={({ isActive }) => (isActive ? 'active' : 'inactive')}>
              Οφειλές
            </NavLink>
            <NavLink
              to="/machine"
              className={({ isActive }) => (isActive ? 'active' : 'inactive')}
            >
              Προβλέψεις Κυκλοφορίας
            </NavLink>
          </>
        )}
        {isLoggedIn ? (
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        ) : (
          <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : 'inactive')}>
            Login
          </NavLink>
        )}
      </nav>
    </header>
  );
}

export default Header;
