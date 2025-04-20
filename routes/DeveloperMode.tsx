import React from 'react';
import IntegratedStealthExample from '../components/integrated-stealth-example';

const DeveloperMode = () => {
  return (
    <div className="developer-mode">
      <div style={{ padding: '20px' }}>
        <h1>Developer Mode</h1>
        <p>This is the original stealth address integration example.</p>
        <IntegratedStealthExample />
      </div>
    </div>
  );
};

export default DeveloperMode; 