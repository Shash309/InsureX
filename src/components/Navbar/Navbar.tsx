import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  account: string | null;
  onConnect: () => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳' }
];

const Navbar: React.FC<NavbarProps> = ({ account, onConnect }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("insurex_language") || "en");
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleLangChange = (e: any) => {
      const newLang = e.detail?.language || localStorage.getItem("insurex_language") || "en";
      setLang(newLang);
    };
    window.addEventListener('languageChange', handleLangChange as EventListener);
    window.addEventListener('storage', handleLangChange);
    return () => {
      window.removeEventListener('languageChange', handleLangChange as EventListener);
      window.removeEventListener('storage', handleLangChange);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.lang-selector-container')) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const changeLanguage = (newLang: string) => {
    localStorage.setItem("insurex_language", newLang);
    window.dispatchEvent(new CustomEvent("languageChange", { 
      detail: { language: newLang } 
    }));
    setLang(newLang);
    setLangDropdownOpen(false);
  };

  const links = [
    { to: '/',         label: 'Home' },
    { to: '/decode',   label: 'Decode Policy' },
    { to: '/compare',  label: 'Compare Policies' },
    { to: '/dashboard',label: 'Dashboard' },
    { to: '/claim',    label: 'File Claim' },
  ];

  const currentFlag = LANGUAGES.find(l => l.code === lang)?.flag || '🌐';

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

        {/* Desktop right-side elements: Language Selector & Wallet button */}
        <div className="hidden md:flex items-center gap-3">
          {/* Global Language Selector Dropdown */}
          <div className="relative lang-selector-container flex items-center">
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E5E0D8] shadow-sm hover:bg-[#F0EDE6] transition-colors text-[#1A1A2E] text-xs font-semibold"
            >
              <span>{currentFlag}</span>
              <span className="uppercase tracking-wider">{lang}</span>
              <span className="text-[8px] text-[#6B7280]">▼</span>
            </button>
            {langDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-[#E5E0D8] rounded-xl shadow-lg z-50 overflow-hidden py-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => changeLanguage(l.code)}
                    className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-[#F0EDE6] transition-colors ${
                      lang === l.code ? 'font-bold text-blue bg-blue-50/20' : 'text-[#1A1A2E]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{l.flag}</span>
                      <span>{l.name}</span>
                    </span>
                    {lang === l.code && <span className="text-blue text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

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
            
            {/* Mobile Language Selector */}
            <div className="px-6 border-b border-[#F8F6F1] flex items-center justify-between" style={{ height: 48 }}>
              <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1.5">
                <span>🌐</span> Select Language
              </span>
              <select
                value={lang}
                onChange={(e) => { changeLanguage(e.target.value); setMenuOpen(false); }}
                className="text-xs bg-white border border-[#E5E0D8] rounded-lg px-2.5 py-1 text-ink focus:outline-none focus:border-blue"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>

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
