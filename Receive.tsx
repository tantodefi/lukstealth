import React, { useCallback } from 'react';

const getAccounts = useCallback(async () => {
  try {
    setError(null);
    setIsWaitingForConnectAccounts(true);
    setLastAction('Connecting to UP wallet...');
    
    // Set a maximum retry count to prevent infinite loops
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    while (retryCount < MAX_RETRIES) {
      try {
        const accounts = await connect();
        
        if (accounts && accounts.length > 0) {
          setIsWaitingForConnectAccounts(false);
          return accounts;
        } else {
          // If we don't have accounts but didn't throw an error, wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
          
          if (retryCount === MAX_RETRIES) {
            throw new Error('Failed to connect to LUKSO UP after multiple attempts');
          }
        }
      } catch (error: any) {
        console.error('Error connecting to wallet:', error);
        
        // If this is a rate limit error, it will be handled by the connect method's retry logic
        // If it's another error, throw it up
        if (error?.code !== -32005 && 
            !(typeof error?.message === 'string' && error.message.includes('limit exceeded'))) {
          throw error;
        }
        
        // Otherwise, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1500));
        retryCount++;
      }
    }
    
    throw new Error('Could not connect to LUKSO UP');
  } catch (error: any) {
    console.error('Error getting accounts:', error);
    setError(error?.message || 'Failed to connect to LUKSO UP wallet');
    setIsWaitingForConnectAccounts(false);
    return [];
  }
}, [connect]); 