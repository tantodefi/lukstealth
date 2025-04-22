// Update initializeFromProvider to include DOM inspection for incognito mode
const initializeFromProvider = async () => {
  try {
    const provider = window.lukso;
    
    if (!provider) {
      console.warn('No LUKSO provider found');
      return false;
    }
    
    // First attempt: try direct access to contextAccounts
    if (provider.contextAccounts?.length > 0) {
      setContextAccounts(provider.contextAccounts);
      if (provider.contextAccounts.length > 0) {
        const gridOwner = provider.contextAccounts[0];
        setIsGridOwner(gridOwner);
        console.log('Grid owner set from provider.contextAccounts:', gridOwner);
      }
      return true;
    }
    
    // Second attempt: try DOM inspection (for incognito mode)
    if (typeof window !== 'undefined' && window.document) {
      // Look for script tags with data-context attribute
      const scriptTags = Array.from(document.querySelectorAll('script[data-context]'));
      for (const script of scriptTags) {
        try {
          const contextData = JSON.parse(script.getAttribute('data-context') || '{}');
          if (contextData?.contextAccounts?.length) {
            setContextAccounts(contextData.contextAccounts);
            if (contextData.contextAccounts.length > 0) {
              const gridOwner = contextData.contextAccounts[0];
              setIsGridOwner(gridOwner);
              console.log('Grid owner set from DOM scriptTag:', gridOwner);
            }
            return true;
          }
        } catch (e) {
          console.warn('Error parsing context data from script:', e);
        }
      }
      
      // Try finding in global context
      if (window.__LUKSO_CONTEXT?.contextAccounts?.length) {
        setContextAccounts(window.__LUKSO_CONTEXT.contextAccounts);
        if (window.__LUKSO_CONTEXT.contextAccounts.length > 0) {
          const gridOwner = window.__LUKSO_CONTEXT.contextAccounts[0];
          setIsGridOwner(gridOwner);
          console.log('Grid owner set from global context:', gridOwner);
        }
        return true;
      }
    }
    
    // Third attempt: try requesting via method calls
    try {
      // Get accounts from provider (if available)
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        console.log('Found accounts:', accounts);
        setUpAccounts(accounts);
      }
      
      // Get context accounts
      const contextMethod = provider.request({ method: 'up_contextAccounts' });
      if (contextMethod) {
        const contextAccounts = await contextMethod;
        console.log('Found context accounts:', contextAccounts);
        if (contextAccounts && contextAccounts.length > 0) {
          setContextAccounts(contextAccounts);
          const gridOwner = contextAccounts[0];
          setIsGridOwner(gridOwner);
          console.log('Grid owner set from up_contextAccounts method:', gridOwner);
          return true;
        }
      }
    } catch (methodError) {
      console.warn('Error requesting accounts from provider:', methodError);
    }
    
    return false;
  } catch (error) {
    console.error('Error initializing from provider:', error);
    return false;
  }
};

// Enhanced polling function for context accounts (especially for incognito mode)
const pollForContextAccounts = () => {
  let pollCount = 0;
  const maxPolls = 10;
  
  const checkForContextAccounts = () => {
    pollCount++;
    console.log(`Polling for context accounts (${pollCount}/${maxPolls})`);
    
    // Method 1: Provider direct access
    if (window.lukso?.contextAccounts?.length > 0) {
      const accounts = window.lukso.contextAccounts;
      setContextAccounts(accounts);
      if (accounts.length > 0) {
        const gridOwner = accounts[0];
        setIsGridOwner(gridOwner);
        console.log('Grid owner set from poll (provider):', gridOwner);
      }
      return true;
    }
    
    // Method 2: DOM inspection
    if (typeof window !== 'undefined' && window.document) {
      // Look for script tags with data-context attribute
      const scriptTags = Array.from(document.querySelectorAll('script[data-context]'));
      for (const script of scriptTags) {
        try {
          const contextData = JSON.parse(script.getAttribute('data-context') || '{}');
          if (contextData?.contextAccounts?.length) {
            setContextAccounts(contextData.contextAccounts);
            if (contextData.contextAccounts.length > 0) {
              const gridOwner = contextData.contextAccounts[0];
              setIsGridOwner(gridOwner);
              console.log('Grid owner set from poll (DOM):', gridOwner);
            }
            return true;
          }
        } catch (e) {
          console.warn('Error parsing context data from script:', e);
        }
      }
      
      // Try finding in global context
      if (window.__LUKSO_CONTEXT?.contextAccounts?.length) {
        setContextAccounts(window.__LUKSO_CONTEXT.contextAccounts);
        if (window.__LUKSO_CONTEXT.contextAccounts.length > 0) {
          const gridOwner = window.__LUKSO_CONTEXT.contextAccounts[0];
          setIsGridOwner(gridOwner);
          console.log('Grid owner set from poll (global):', gridOwner);
        }
        return true;
      }
    }
    
    // Method 3: Try iframe message
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'GET_CONTEXT_ACCOUNTS' }, '*');
        console.log('Sent message to parent requesting context accounts');
      } catch (e) {
        console.warn('Error sending message to parent:', e);
      }
    }
    
    return false;
  };
  
  // Initial check
  if (!checkForContextAccounts()) {
    // Set up polling
    const pollInterval = setInterval(() => {
      if (checkForContextAccounts() || pollCount >= maxPolls) {
        clearInterval(pollInterval);
      }
    }, 250);
    
    // Clear interval after timeout
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 5000);
  }
}; 