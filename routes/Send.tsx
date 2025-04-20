import React from 'react';
import { Link } from 'react-router-dom';

const Send = () => {
  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', textAlign: 'center' }}>Send Funds</h1>
      
      <p style={{ marginBottom: '30px', textAlign: 'center' }}>
        Send funds privately to any stealth meta-address.
      </p>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="recipient" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Recipient's Stealth Meta-Address
        </label>
        <input
          id="recipient"
          type="text"
          placeholder="st:xxxxxx..."
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem'
          }}
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="amount" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Amount (LYX)
        </label>
        <input
          id="amount"
          type="number"
          placeholder="0.0"
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem'
          }}
        />
      </div>
      
      <button style={{
        backgroundColor: '#3498db',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
        width: '100%',
        marginTop: '20px'
      }}>
        Send Privately
      </button>
      
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#3498db', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Send; 