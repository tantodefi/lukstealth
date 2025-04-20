import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface PendingPayment {
  id: number;
  amount: string;
  date: string;
  ephemeralKey: string;
  status: 'pending' | 'withdrawn';
}

const Withdraw = () => {
  const [viewingKey, setViewingKey] = useState<string>('');
  const [spendingKey, setSpendingKey] = useState<string>('');
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // This would actually scan the blockchain in a real implementation
  const handleScan = () => {
    if (!viewingKey.trim()) return;
    
    setIsScanning(true);
    
    // Simulate network delay
    setTimeout(() => {
      // This is just dummy data for the UI
      setPendingPayments([
        {
          id: 1,
          amount: '0.5 LYX',
          date: '2023-11-15',
          ephemeralKey: '0x1a2b3c...',
          status: 'pending'
        },
        {
          id: 2,
          amount: '1.2 LYX',
          date: '2023-11-10',
          ephemeralKey: '0x4d5e6f...',
          status: 'pending'
        }
      ]);
      setIsScanning(false);
    }, 2000);
  };

  const handleWithdraw = (id: number) => {
    if (!spendingKey.trim()) {
      alert('Please enter your spending key');
      return;
    }
    
    // In a real implementation, this would construct and submit a transaction
    setPendingPayments(
      pendingPayments.map(payment => 
        payment.id === id 
          ? { ...payment, status: 'withdrawn' } 
          : payment
      )
    );
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', textAlign: 'center' }}>Withdraw Funds</h1>
      
      <p style={{ marginBottom: '30px', textAlign: 'center' }}>
        Enter your viewing key to scan for incoming stealth payments.
      </p>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '30px', 
        borderRadius: '8px',
        marginBottom: '30px'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="viewingKey" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Your Viewing Key
          </label>
          <input
            id="viewingKey"
            type="text"
            value={viewingKey}
            onChange={(e) => setViewingKey(e.target.value)}
            placeholder="Enter your viewing key"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          />
        </div>
        
        <button 
          onClick={handleScan}
          disabled={isScanning || !viewingKey.trim()}
          style={{
            backgroundColor: isScanning ? '#95a5a6' : '#e74c3c',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '4px',
            border: 'none',
            cursor: isScanning ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {isScanning ? 'Scanning...' : 'Scan for Payments'}
        </button>
      </div>
      
      {pendingPayments.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>
            Pending Payments
          </h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="spendingKey" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Your Spending Key (required to withdraw)
            </label>
            <input
              id="spendingKey"
              type="text"
              value={spendingKey}
              onChange={(e) => setSpendingKey(e.target.value)}
              placeholder="Enter your spending key"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                marginBottom: '20px'
              }}
            />
          </div>
          
          {pendingPayments.map((payment) => (
            <div 
              key={payment.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: payment.status === 'withdrawn' ? '#e8f5e9' : 'white'
              }}
            >
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {payment.amount}
                </div>
                <div style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>
                  Received: {payment.date}
                </div>
                <div style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>
                  Ephemeral key: {payment.ephemeralKey}
                </div>
              </div>
              <button
                onClick={() => handleWithdraw(payment.id)}
                disabled={payment.status === 'withdrawn'}
                style={{
                  backgroundColor: payment.status === 'withdrawn' ? '#27ae60' : '#e74c3c',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: payment.status === 'withdrawn' ? 'default' : 'pointer'
                }}
              >
                {payment.status === 'withdrawn' ? 'Withdrawn' : 'Withdraw'}
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <Link to="/" style={{ color: '#3498db', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default Withdraw; 