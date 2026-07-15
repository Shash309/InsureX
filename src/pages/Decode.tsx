import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AIAnalysisResult } from '../types';
import { API_URL } from '../config/env';

interface DecodeProps {
  account: string | null;
  provider: any;
  signer: any;
}

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  B: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  C: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  D: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  F: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', flag: '🇮🇳' }
];

const SpinnerIcon = () => (
  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

export const Decode: React.FC<DecodeProps> = ({ provider: _p, signer: _s }) => {
  const [pastedText, setPastedText]   = useState('');
  const [analyzing, setAnalyzing]     = useState(false);
  const [result, setResult]           = useState<AIAnalysisResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [language, setLanguage] = useState(
    localStorage.getItem("insurex_language") || "en"
  );

  useEffect(() => {
    const handler = (e: any) => setLanguage(e.detail.language);
    window.addEventListener("languageChange", handler as EventListener);
    return () => window.removeEventListener("languageChange", handler as EventListener);
  }, []);

  const changeLanguage = (newLang: string) => {
    localStorage.setItem("insurex_language", newLang);
    setLanguage(newLang);
    window.dispatchEvent(new CustomEvent("languageChange", { 
      detail: { language: newLang } 
    }));
  };

  const langNames: Record<string, string> = {
    en: "English", hi: "हिंदी", ta: "தமிழ்",
    te: "తెలుగు", bn: "বাংলা", mr: "मराठी"
  };

  const SAMPLE_TEXT =
    'This policy covers hospitalization expenses up to $50,000 per year. ' +
    'Claims must be filed within 48 hours of incident. ' +
    'Pre-existing conditions are excluded. ' +
    'Mental health coverage is excluded. ' +
    'Acts of god are not covered. ' +
    'Policy lapses if premium is unpaid for more than 15 days.';

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPastedText(e.target.value);
    if (e.target.value) {
      setUploadError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pastedText.trim()) {
      setUploadError('Please paste policy text.');
      return;
    }

    if (pastedText.trim().length < 50) {
      setUploadError('Policy text is too short. Please enter at least 50 characters.');
      return;
    }

    setAnalyzing(true);
    setUploadError(null);
    setResult(null);

    try {
      const isEnglish = language === 'en';
      const endpoint = isEnglish ? `${API_URL}/decode` : `${API_URL}/decode/multilang`;
      const body = isEnglish 
        ? { text: pastedText.trim() }
        : { text: pastedText.trim(), language: language };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Backend decode failed' }));
        throw new Error(errorData.detail || 'Backend decode failed');
      }
      
      setResult(await response.json());
    } catch (err: any) {
      setUploadError(err.message || 'Could not reach FastAPI.');
    } finally {
      setAnalyzing(false);
    }
  };

  const gradeStyle = result ? (GRADE_STYLES[result.grade] ?? GRADE_STYLES.F) : null;

  return (
    <div className="bg-[#F8F6F1] dot-grid min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Page header */}
        <div className="mb-12">
          <span className="pill pill-blue mb-4">AI Policy Decoder</span>
          <h1 className="serif text-4xl md:text-5xl mb-3" style={{ color: '#1A1A2E', opacity: 1 }}>
            Decode your policy
          </h1>
          <p className="text-[#6B7280] max-w-xl">
            Paste any insurance document text. Our AI extracts every clause, flags the traps,
            and grades your coverage in plain English.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">

          {/* ── Left panel: Paste Text ── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Paste card */}
            <div className="card p-6">
              <h2 className="serif text-xl font-semibold mb-5" style={{ color: '#1A1A2E' }}>Policy Text Input</h2>

              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                {uploadError && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <span className="mt-0.5">⚠</span>
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* ── Paste text area ── */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="policy-text"
                    className="block text-[10px] uppercase font-bold text-[#6B7280] tracking-wider"
                  >
                    Paste policy text directly
                  </label>
                  <textarea
                    id="policy-text"
                    rows={12}
                    value={pastedText}
                    onChange={handleTextChange}
                    placeholder="Paste your insurance policy text here..."
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:border-[#2563EB] transition-colors"
                    style={{
                      color: '#1A1A2E',
                      background: pastedText ? '#fff' : '#F8F6F1',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  />
                  {/* Sample text button */}
                  <button
                    type="button"
                    onClick={() => {
                      setPastedText(SAMPLE_TEXT);
                      setUploadError(null);
                    }}
                    className="self-start text-xs text-[#2563EB] hover:underline underline-offset-2 mt-0.5 transition-opacity hover:opacity-80"
                  >
                    Use sample policy text →
                  </button>
                </div>

                {/* ── Language Selector ── */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-[10px] uppercase font-bold text-[#6B7280] tracking-wider">
                    Select Output Language:
                  </label>
                  <select
                    value={language}
                    onChange={(e) => changeLanguage(e.target.value)}
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-sm text-[#1A1A2E] bg-white focus:outline-none focus:border-[#2563EB] transition-colors"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.flag} {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!pastedText.trim() || analyzing}
                  className="btn w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#1A1A2E', color: '#FFFFFF', opacity: 1 }}
                >
                  {analyzing ? <><SpinnerIcon /> Analysing…</> : 'Decode Policy →'}
                </button>
              </form>
            </div>

            {/* CTA to Dashboard after result */}
            {result && (
              <div className="card p-6 border-[#2563EB]/30 text-center flex flex-col gap-3">
                <div className="text-2xl">🛡️</div>
                <h3 className="serif text-lg font-semibold" style={{ color: '#1A1A2E' }}>
                  Ready to mint?
                </h3>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  Happy with the analysis? Head to the Dashboard to mint this policy as an on-chain NFT.
                </p>
                <Link
                  to="/dashboard"
                  className="btn w-full justify-center text-sm"
                  style={{ background: '#2563EB', color: '#FFFFFF', opacity: 1 }}
                >
                  Mint on Dashboard →
                </Link>
              </div>
            )}
          </div>

          {/* ── Right panel: AI Result ── */}
          <div className="lg:col-span-3">
            {result ? (
              <div className="flex flex-col gap-5">

                {/* Grade + summary */}
                <div className="card p-6 flex gap-5 items-start">
                  <div
                    className="shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2"
                    style={{ background: gradeStyle!.bg, borderColor: gradeStyle!.border }}
                  >
                    <span className="serif text-4xl font-bold" style={{ color: gradeStyle!.text }}>{result.grade}</span>
                    <span className="text-[9px] uppercase font-bold tracking-widest mt-0.5" style={{ color: gradeStyle!.text }}>Grade</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="serif text-xl font-semibold text-ink">AI Audit Summary</h3>
                      <span className="pill pill-blue text-[10px] py-0.5 px-2">
                        Results in: {langNames[language]}
                      </span>
                    </div>
                    <p className="text-sm text-[#6B7280] leading-relaxed">{result.summary}</p>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="card p-5">
                  <p className="text-[10px] uppercase font-bold text-[#6B7280] tracking-wider mb-2">Audit Reasoning</p>
                  <p className="text-sm leading-relaxed text-ink">{result.grade_reason}</p>
                </div>

                {/* Clauses grid */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="card p-5">
                    <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Coverages
                    </h4>
                    <ul className="flex flex-col gap-2.5">
                      {result.coverage.map((item, i) => (
                        <li key={i} className="text-xs text-[#6B7280] leading-relaxed pl-3 border-l-2 border-emerald-200">{item}</li>
                      ))}
                      {result.coverage.length === 0 && <span className="text-xs text-[#6B7280] italic">None detected</span>}
                    </ul>
                  </div>

                  <div className="card p-5">
                    <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Exclusions
                    </h4>
                    <ul className="flex flex-col gap-2.5">
                      {result.exclusions.map((item, i) => (
                        <li key={i} className="text-xs text-[#6B7280] leading-relaxed pl-3 border-l-2 border-amber-200">{item}</li>
                      ))}
                      {result.exclusions.length === 0 && <span className="text-xs text-[#6B7280] italic">None detected</span>}
                    </ul>
                  </div>

                  <div className="card p-5">
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" /> Trap Clauses
                    </h4>
                    <ul className="flex flex-col gap-2.5">
                      {result.gotchas.map((item, i) => (
                        <li key={i} className="text-xs text-[#6B7280] leading-relaxed pl-3 border-l-2 border-red-200">{item}</li>
                      ))}
                      {result.gotchas.length === 0 && <span className="text-xs text-[#6B7280] italic">None detected</span>}
                    </ul>
                  </div>
                </div>

              </div>
            ) : (
              /* Empty state */
              <div className="card h-[420px] flex flex-col items-center justify-center text-center p-10">
                <div className="w-16 h-16 rounded-2xl bg-[#F0EDE6] flex items-center justify-center text-[#6B7280] mb-6">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <h3 className="serif text-2xl mb-2" style={{ color: '#1A1A2E' }}>No analysis yet</h3>
                <p className="text-sm text-[#6B7280] max-w-xs leading-relaxed">
                  Paste and decode your insurance policy text. The AI grade report will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Decode;
