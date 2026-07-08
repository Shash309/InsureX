import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home';
import Decode from './pages/Decode';
import Dashboard from './pages/Dashboard';
import Claim from './pages/Claim';
import Compare from './pages/Compare';
import { useWallet } from './hooks/useWallet';

export const App: React.FC = () => {
  const { account, error, provider, signer, connectWallet } = useWallet();

  return (
    <Router>
      <div className="bg-[#F8F6F1] min-h-screen text-[#1A1A2E] font-sans selection:bg-blue-100 selection:text-[#1A1A2E]">

        {/* Navigation */}
        <Navbar
          account={account}
          onConnect={connectWallet}
        />

        {/* Global error toast */}
        {error && (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-white border border-red-200 text-red-700 p-4 rounded-2xl shadow-lg">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-1 text-red-500">MetaMask Error</h4>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        )}

        {/* Routes */}
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/decode"    element={<Decode    account={account} provider={provider} signer={signer} />} />
          <Route path="/compare"   element={<Compare />} />
          <Route path="/dashboard" element={<Dashboard account={account} provider={provider} signer={signer} connectWallet={connectWallet} />} />
          <Route path="/claim"     element={<Claim     account={account} provider={provider} signer={signer} />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
