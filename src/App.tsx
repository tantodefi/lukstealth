import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { UpProvider } from './upProvider';
import Routes from './Routes'; // Assuming you have a Routes component

function App() {
  return (
    <UpProvider>
      <Router>
        <Routes />
      </Router>
    </UpProvider>
  );
}

export default App; 