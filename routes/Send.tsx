import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Send = () => {
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('0.01');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  
  // Get the recipient address from URL parameters if provided
  const location = useLocation();
  
  useEffect(() => {
    // Parse the query parameters
    const params = new URLSearchParams(location.search);
    const recipientParam = params.get('recipient');
    
    if (recipientParam) {
      setRecipient(recipientParam);
      console.log(`Recipient set from URL parameter: ${recipientParam}`);
    }
  }, [location]);
  
  const handleSend = async () => {
    if (!recipient) {
      setSendStatus('Please enter a recipient address');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setSendStatus('Please enter a valid amount');
      return;
    }
    
    setIsSending(true);
    setSendStatus('Preparing transaction...');
    
    // Simulate sending - in a real app, this would interact with the blockchain
    setTimeout(() => {
      setSendStatus('This is a demo - no actual transaction is being sent');
      setIsSending(false);
    }, 2000);
  };
  
  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ 
        marginBottom: '20px', 
        textAlign: 'center',
        backgroundColor: '#000000',
        color: '#ffffff',
        padding: '15px',
        borderRadius: '8px'
      }}>Send Funds</h1>
      
      <p style={{ marginBottom: '30px', textAlign: 'center' }}>
        Send funds privately to any stealth meta-address.
      </p>
      
      <div style={{ 
        backgroundColor: '#1c2531',
        borderRadius: '12px',
        padding: '30px',
        marginBottom: '30px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '25px' }}>
          <label htmlFor="recipient" style={{ 
            display: 'block', 
            marginBottom: '10px', 
            fontWeight: 'bold',
            color: '#ffffff'
          }}>
            Recipient's Stealth Meta-Address
          </label>
          <input
            id="recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="st:lyx:xxxxxx..."
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '1rem',
              color: '#ffffff',
              fontFamily: 'monospace'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '25px' }}>
          <label htmlFor="amount" style={{ 
            display: 'block', 
            marginBottom: '10px', 
            fontWeight: 'bold',
            color: '#ffffff'
          }}>
            Amount (LYX)
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              id="amount"
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              style={{
                flex: 1,
                padding: '15px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '1rem',
                color: '#ffffff'
              }}
            />
            <div style={{
              marginLeft: '10px',
              backgroundColor: 'rgba(9,132,227,0.2)',
              padding: '15px',
              borderRadius: '8px',
              color: '#0984e3',
              fontWeight: 'bold'
            }}>
              LYX
            </div>
          </div>
        </div>
        
        {sendStatus && (
          <div style={{ 
            backgroundColor: sendStatus.includes('error') || sendStatus.includes('Please') 
              ? 'rgba(255,107,107,0.1)' 
              : 'rgba(46,213,115,0.1)', 
            color: sendStatus.includes('error') || sendStatus.includes('Please')
              ? '#ff7675' 
              : '#00b894', 
            padding: '15px', 
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {sendStatus}
          </div>
        )}
        
        <button 
          onClick={handleSend}
          disabled={isSending || !recipient}
          style={{
            backgroundColor: '#0984e3',
            color: 'white',
            padding: '15px 24px',
            borderRadius: '30px',
            border: 'none',
            cursor: isSending || !recipient ? 'default' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            width: '100%',
            marginTop: '10px',
            opacity: isSending || !recipient ? 0.7 : 1,
            boxShadow: '0 4px 10px rgba(9,132,227,0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          {isSending ? 'Sending...' : 'Send Privately'}
        </button>
      </div>
      
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#3498db', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Send; 