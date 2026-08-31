import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { ToastContainer } from '../ui/Toast';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col selection:bg-accent/20 selection:text-accent">
      <Header />
      <div className="flex-1">
        {children}
      </div>
      <Footer />
      <ToastContainer />
    </div>
  );
};
