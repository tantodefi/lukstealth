import React from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

const Layout = () => {
  return (
    <div className="app-layout">
      <Navigation />
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 