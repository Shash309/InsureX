import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  account: string | null;
  onConnect: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ account, onConnect }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { to: '/',         label: 'Home' },
    { to: '/decode',   label: 'Decode Policy' },
    { to: '/compare',  label: 'Compare Policies' },
    { to: '/dashboard',label: 'Dashboard' },
    { to: '/claim',    label: 'File Claim' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'navbar-blur border-b border-[#E5E0D8] shadow-sm' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path
                d="M50 8 L88 28 L88 68 L50 92 L12 68 L12 28 Z"
                fill="none"
                stroke="#1A1A2E"
                strokeWidth="7"
                className="group-hover:stroke-[#2563EB] transition-colors duration-300"
              />
              <path
                d="M32 50 L44 62 L68 38"
                fill="none"
                stroke="#2563EB"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="serif font-bold text-xl text-ink tracking-tight">
            Insure<span className="text-blue">X</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ to, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-[#1A1A2E]'
                    : 'text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#F0EDE6]'
                }`}
                style={active ? { color: '#FFFFFF', opacity: 1 } : {}}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Desktop right-side elements: Wallet button */}
        <div className="hidden md:flex items-center gap-3">
          {account ? (
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-[#E5E0D8] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="mono text-[0.78rem] text-ink font-medium">
                {account.slice(0, 6)}…{account.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="btn btn-primary text-sm shadow-sm"
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-8 h-8 flex flex-col justify-center gap-1.5"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 bg-ink transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block h-0.5 bg-ink transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 bg-ink transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="absolute top-16 left-0 right-0 md:hidden bg-white border-b border-[#E5E0D8] shadow-lg flex flex-col z-50" style={{ width: '100vw', maxWidth: '100vw' }}>
          <div className="flex flex-col">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="px-6 text-sm font-medium border-b border-[#F8F6F1] transition-colors flex items-center"
                style={{ height: 48 }}
              >
                <span className={location.pathname === to ? 'text-[#2563EB] font-bold' : 'text-[#1A1A2E]'}>
                  {label}
                </span>
              </Link>
            ))}

            {/* Wallet status */}
            <div className="bg-[#F8F6F1] px-6 py-4 flex items-center justify-between">
              {account ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="mono text-xs text-[#1A1A2E] font-semibold">
                    Connected: {account.slice(0, 6)}…{account.slice(-4)}
                  </span>
                </div>
              ) : (
                <button 
                  onClick={() => { setMenuOpen(false); onConnect(); }} 
                  className="btn btn-primary w-full justify-center text-sm"
                  style={{ minHeight: 48 }}
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
