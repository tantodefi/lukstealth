import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Receive = () => {
  const [stealthMetaAddress, setStealthMetaAddress] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // This would be populated from actual data in a real implementation
  const dummyStealthMetaAddress = 'st:eth:0xd8da6bf26964af9d7eed9e03e53415d37aa96045:0291c9ed37f44b733386b18626371f4a91e99a20e4b22e8b4c4b2212994189d74b:04bd4a1042eefe95a9ab5cf2e0ddad85804dc79f42c73b2190e48ed0a36dd1d9d79a0e29b8bc0f650aab5a41884b68ca9cad64a20552d054fc2f658d08c4c8badf';

  const handleGenerateMetaAddress = () => {
    // In a real implementation, this would generate a real stealth meta-address
    setStealthMetaAddress(dummyStealthMetaAddress);
  };

  const handleCopyAddress = () => {
    if (stealthMetaAddress) {
      navigator.clipboard.writeText(stealthMetaAddress);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', textAlign: 'center' }}>Receive Funds</h1>
      
      <p style={{ marginBottom: '30px', textAlign: 'center' }}>
        Generate and share your stealth meta-address to receive private payments.
      </p>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '30px', 
        borderRadius: '8px',
        marginBottom: '30px'
      }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', textAlign: 'center' }}>
          Your Stealth Meta-Address
        </h2>
        
        {!stealthMetaAddress ? (
          <button 
            onClick={handleGenerateMetaAddress}
            style={{
              backgroundColor: '#2ecc71',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'block',
              margin: '0 auto'
            }}
          >
            Generate Stealth Meta-Address
          </button>
        ) : (
          <>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '12px',
              wordBreak: 'break-all',
              marginBottom: '15px',
              fontSize: '0.9rem'
            }}>
              {stealthMetaAddress}
            </div>
            
            <button
              onClick={handleCopyAddress}
              style={{
                backgroundColor: isCopied ? '#2ecc71' : '#3498db',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'block',
                margin: '0 auto',
                transition: 'background-color 0.3s'
              }}
            >
              {isCopied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </>
        )}
      </div>
      
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#3498db', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Receive; 