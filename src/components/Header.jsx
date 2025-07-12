// src/components/Header.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data=await response.json();
        window.location.href=data.redirect;
      } else {
        console.error("Logout failed!");
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="header flex justify-between items-center p-4 bg-gray-900 text-white shadow-md">
      <h1 className="text-2xl font-bold">HealthAssist</h1>
      <button
        onClick={handleLogout}
        className="logout-button"
      >
        Logout
      </button>
    </div>
  );
};

export default Header;
