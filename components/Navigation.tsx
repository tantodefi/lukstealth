import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Navigation links configuration
  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/send', label: 'Send' },
    { path: '/receive', label: 'Receive' },
    { path: '/scan', label: 'Scan' },
    { path: '/developer-mode', label: 'Developer Mode' }
  ];

  return (
    <>
      {/* Hamburger Menu Button */}
      <div
        className="hamburger-menu"
        onClick={toggleMenu}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          cursor: 'pointer',
          background: 'rgba(0, 0, 0, 0.7)',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px',
        }}
      >
        <div style={{
          width: '25px',
          height: '3px',
          backgroundColor: 'white',
          margin: '3px 0',
          transition: 'all 0.3s ease',
          transform: isMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none'
        }} />
        <div style={{
          width: '25px',
          height: '3px',
          backgroundColor: 'white',
          margin: '3px 0',
          transition: 'all 0.3s ease',
          opacity: isMenuOpen ? 0 : 1
        }} />
        <div style={{
          width: '25px',
          height: '3px',
          backgroundColor: 'white',
          margin: '3px 0',
          transition: 'all 0.3s ease',
          transform: isMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none'
        }} />
      </div>

      {/* Side Menu */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '250px',
        height: '100vh',
        backgroundColor: '#212121',
        zIndex: 999,
        transform: isMenuOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        boxShadow: isMenuOpen ? '-5px 0 15px rgba(0, 0, 0, 0.2)' : 'none',
        padding: '80px 0 20px'
      }}>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {navLinks.map((link) => (
              <li key={link.path} style={{ margin: '10px 0' }}>
                <Link
                  to={link.path}
                  onClick={closeMenu}
                  style={{
                    display: 'block',
                    padding: '15px 20px',
                    color: location.pathname === link.path ? '#3498db' : 'white',
                    textDecoration: 'none',
                    borderLeft: location.pathname === link.path ? '4px solid #3498db' : '4px solid transparent',
                    fontWeight: location.pathname === link.path ? 'bold' : 'normal',
                    transition: 'all 0.2s'
                  }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Overlay to close menu when clicking outside */}
      {isMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 998,
          }}
          onClick={closeMenu}
        />
      )}
    </>
  );
};

export default Navigation; 