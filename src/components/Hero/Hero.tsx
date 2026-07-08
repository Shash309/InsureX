import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    ),
    title: 'AI Policy Decoder',
    body: 'Upload any PDF. Gemini AI reads the fine print, flags exclusions, and grades your coverage in seconds.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    ),
    title: 'On-Chain Policy NFT',
    body: 'Your decoded policy is minted as an ERC-721 NFT. Immutable, portable, and always yours.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
    title: 'Automatic Claims',
    body: 'Parametric triggers via Chainlink oracles. No adjusters, no forms — claims pay out the moment conditions are met.',
  },
];

const STATS = [
  { value: '2.4 s',   label: 'Avg. AI decode time' },
  { value: '$0',      label: 'Claim adjuster fees' },
  { value: '100 %',   label: 'On-chain auditability' },
  { value: '< 1 min', label: 'Auto-settlement time' },
];

const Hero: React.FC = () => {
  const headingRef  = useRef<HTMLHeadingElement>(null);
  const subRef      = useRef<HTMLParagraphElement>(null);
  const ctaRef      = useRef<HTMLDivElement>(null);
  const statsRef    = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Slide-up only — opacity stays 1 so elements are never invisible
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl
      .from(headingRef.current,  { y: 40, duration: 0.9 }, 0)
      .from(subRef.current,      { y: 30, duration: 0.7 }, 0.25)
      .from(ctaRef.current,      { y: 24, duration: 0.6 }, 0.45)
      .from(statsRef.current,    { y: 20, duration: 0.6 }, 0.65)
      .from('.feature-card',     { y: 36, stagger: 0.12, duration: 0.7 }, 0.8);
  }, []);

  return (
    <div className="bg-[#F8F6F1] dot-grid min-h-screen">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-36 pb-24 text-center">
        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#E5E0D8] shadow-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
          <span className="text-xs font-semibold text-[#6B7280] tracking-widest uppercase">
            AI · Blockchain · Zero Paperwork
          </span>
        </div>

        {/* Headline */}
        <h1
          ref={headingRef}
          className="serif leading-[1.1] mb-7"
          style={{ color: '#1A1A2E', fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 700, opacity: 1 }}
        >
          Insurance, finally
          <br />
          <em className="not-italic" style={{ color: '#2563EB' }}>explained in plain English.</em>
        </h1>

        {/* Sub-headline */}
        <p
          ref={subRef}
          className="max-w-2xl mx-auto text-lg leading-relaxed mb-10"
          style={{ color: '#4B5563', opacity: 1 }}
        >
          Upload any policy. Our AI reads the fine print, flags the traps, and mints it
          on-chain — so your coverage is immutable, portable, and actually yours.
        </p>

        {/* CTAs */}
        <div ref={ctaRef} className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/decode"
            className="btn text-base px-8 py-3.5 shadow-lg"
            style={{ background: '#1A1A2E', color: '#FFFFFF', opacity: 1, borderColor: '#1A1A2E' }}
          >
            Decode My Policy
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </Link>
          <Link
            to="/dashboard"
            className="btn text-base px-8 py-3.5"
            style={{ background: 'transparent', color: '#1A1A2E', border: '2px solid #1A1A2E', opacity: 1 }}
          >
            View Dashboard
          </Link>
        </div>

        {/* Trust note */}
        <p className="mt-6 text-xs text-[#6B7280]">
          No sign-up required · Connect MetaMask to get started
        </p>
      </section>

      {/* ── Stats bar ─────────────────────────────────────── */}
      <div ref={statsRef} className="max-w-5xl mx-auto px-6 mb-24">
        <div className="card rounded-2xl px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x-0 md:divide-x divide-y md:divide-y-0 divide-[#E5E0D8]">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-4 md:py-0">
              <span
                className="mono font-semibold"
                style={{ color: '#1A1A2E', fontSize: '36px', opacity: 1 }}
              >{value}</span>
              <span
                className="text-xs mt-1 text-center"
                style={{ color: '#6B7280', opacity: 1 }}
              >{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <span className="pill pill-ink mb-4">How It Works</span>
          <h2 className="serif text-4xl" style={{ color: '#1A1A2E', opacity: 1 }}>Three steps to clarity</h2>
        </div>

        <div ref={featuresRef} className="grid md:grid-cols-3 gap-6">
          {FEATURES.map(({ icon, title, body }, i) => (
            <div key={title} className="feature-card card p-8 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#F0EDE6] flex items-center justify-center text-[#2563EB]">
                {icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="mono text-xs text-[#6B7280]">0{i + 1}</span>
                  <h3 className="serif text-xl text-ink font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <div className="rounded-3xl bg-[#1A1A2E] text-white px-10 py-14 text-center relative overflow-hidden">
          {/* decorative circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#2563EB] opacity-10" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#D97706] opacity-10" />

          <span className="pill bg-white/10 text-white text-xs mb-6">Get started today</span>
          <h2 className="serif text-3xl sm:text-4xl font-bold mb-4 relative z-10">
            Ready to understand your insurance?
          </h2>
          <p className="text-white/60 max-w-xl mx-auto mb-8 relative z-10">
            Connect MetaMask, upload your policy PDF, and get an AI-powered grade report in under 3 seconds.
          </p>
          <div className="flex flex-wrap justify-center gap-4 relative z-10">
            <Link to="/decode" className="btn btn-blue text-base px-8 py-3.5 shadow-lg">
              Start for Free
            </Link>
            <Link to="/claim" className="btn text-base px-8 py-3.5 border-2 border-white/20 text-white hover:border-white/50">
              File a Claim
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Hero;
