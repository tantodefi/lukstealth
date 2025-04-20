import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="umbra-style">
      <div className="hero" style={{ 
        backgroundColor: '#1a1a1a', 
        color: 'white', 
        padding: '80px 20px',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontSize: '3.5rem', 
          fontWeight: '700', 
          marginBottom: '20px' 
        }}>
          LukStealth
        </h1>
        <p style={{ 
          fontSize: '1.5rem', 
          maxWidth: '800px', 
          margin: '0 auto 30px' 
        }}>
          Private payments on LUKSO using stealth addresses
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
          <Link to="/send" style={{
            backgroundColor: '#3498db',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem'
          }}>
            Send
          </Link>
          <Link to="/receive" style={{
            backgroundColor: '#2ecc71',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem'
          }}>
            Receive
          </Link>
          <Link to="/withdraw" style={{
            backgroundColor: '#e74c3c',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem'
          }}>
            Withdraw
          </Link>
        </div>
      </div>

      <div style={{ 
        padding: '60px 20px', 
        maxWidth: '1200px', 
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <h2 style={{ fontSize: '2.2rem', marginBottom: '20px' }}>How It Works</h2>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '30px',
          margin: '40px 0' 
        }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>1. Create your stealth meta-address</h3>
            <p>Generate a unique stealth meta-address (SMA) that others can use to send you funds privately.</p>
          </div>
          
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>2. Share your SMA</h3>
            <p>Share your stealth meta-address with others who want to send you funds privately.</p>
          </div>
          
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>3. Withdraw your funds</h3>
            <p>Check for new payments and withdraw your funds to any address of your choice.</p>
          </div>
        </div>

        <div style={{ marginTop: '60px' }}>
          <h2 style={{ fontSize: '2.2rem', marginBottom: '20px' }}>Why Use LukStealth?</h2>
          <p style={{ fontSize: '1.2rem', maxWidth: '800px', margin: '0 auto 40px' }}>
            LukStealth allows you to receive funds without revealing your identity or transaction history.
            It's perfect for private payments, donations, and more on LUKSO.
          </p>
          
          <Link to="/developer-mode" style={{
            backgroundColor: '#9b59b6',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'inline-block'
          }}>
            Developer Mode
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home; 