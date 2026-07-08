import React, { useState } from 'react';

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  B: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  C: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  D: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  F: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

const SpinnerIcon = () => (
  <svg className="w-5 h-5 animate-spin text-[#1A1A2E]" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

export const Compare: React.FC = () => {
  const [labelA, setLabelA] = useState('Policy A');
  const [policyA, setPolicyA] = useState('');
  const [labelB, setLabelB] = useState('Policy B');
  const [policyB, setPolicyB] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const loadSamples = () => {
    setLabelA("PremiumGuard Plus");
    setPolicyA(
      "TRAVEL INSURANCE — PremiumGuard Plus\n" +
      "Coverage: Emergency medical up to $200,000.\n" +
      "Trip cancellation covered for any reason up to $15,000.\n" +
      "Claims can be filed within 30 days of incident.\n" +
      "Digital copies of bills accepted.\n" +
      "No pre-authorization required for emergency treatment.\n" +
      "Baggage loss covered up to $3,000 with self-declaration.\n" +
      "Flight delay compensation starts at 2 hours at $100/hour.\n" +
      "Policy renewable with no premium increase for first 3 years."
    );

    setLabelB("BasicShield");
    setPolicyB(
      "TRAVEL INSURANCE — BasicShield\n" +
      "Coverage: Emergency medical up to $20,000 only.\n" +
      "Trip cancellation covered only for natural disasters.\n" +
      "Claims must be filed within 12 hours of incident.\n" +
      "Original physical bills only, no digital copies.\n" +
      "Pre-authorization required for ALL treatments above $500.\n" +
      "Baggage loss requires police report within 2 hours.\n" +
      "Flight delay compensation only after 8 hour delay.\n" +
      "Premium can increase up to 50% at each renewal."
    );
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyA.trim() || !policyB.trim()) {
      setError('Please paste policy text for both policies.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('http://localhost:8000/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_a: policyA.trim(),
          policy_b: policyB.trim(),
          label_a: labelA.trim() || "Policy A",
          label_b: labelB.trim() || "Policy B"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Backend comparison failed' }));
        throw new Error(errorData.detail || 'Backend comparison failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Could not connect to backend.');
    } finally {
      setAnalyzing(false);
    }
  };

  const inputCls = "w-full border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-sm text-[#1A1A2E] bg-white focus:outline-none focus:border-[#2563EB] transition-colors";
  const labelCls = "block text-[10px] uppercase font-bold text-[#6B7280] tracking-wider mb-1.5";

  return (
    <div className="bg-[#F8F6F1] dot-grid min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-10">
        
        {/* Page Header */}
        <div>
          <span className="pill pill-ink mb-3">AI Comparison</span>
          <h1 className="serif text-4xl md:text-5xl" style={{ color: '#1A1A2E' }}>
            Compare Policies
          </h1>
          <p className="text-[#6B7280] mt-2 text-sm max-w-xl">
            Paste two policies side-by-side. Our AI will analyze them, grade key areas, highlight traps, and provide a clear recommendation.
          </p>
        </div>

        {/* Section 1: Inputs */}
        <div className="card p-6 md:p-8">
          <form onSubmit={handleCompare} className="flex flex-col gap-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Input */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className={labelCls}>Policy A Name</label>
                  <input
                    type="text"
                    value={labelA}
                    onChange={e => setLabelA(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. PremiumGuard Plus"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Policy A Text</label>
                  <textarea
                    rows={8}
                    value={policyA}
                    onChange={e => setPolicyA(e.target.value)}
                    className={`${inputCls} font-mono text-xs`}
                    placeholder="Paste Policy A text here..."
                    required
                  />
                </div>
              </div>

              {/* Right Input */}
              <div className="flex flex-col gap-3">
                <div>
                  <label className={labelCls}>Policy B Name</label>
                  <input
                    type="text"
                    value={labelB}
                    onChange={e => setLabelB(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. BasicShield"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Policy B Text</label>
                  <textarea
                    rows={8}
                    value={policyB}
                    onChange={e => setPolicyB(e.target.value)}
                    className={`${inputCls} font-mono text-xs`}
                    placeholder="Paste Policy B text here..."
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs">
                ⚠ {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="submit"
                disabled={analyzing}
                className="btn justify-center text-sm flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#1A1A2E', color: '#FFFFFF', opacity: 1 }}
              >
                {analyzing ? <><SpinnerIcon /> Analyzing both policies…</> : 'Compare Policies'}
              </button>
              <button
                type="button"
                onClick={loadSamples}
                disabled={analyzing}
                className="btn justify-center text-sm border-2 border-[#1A1A2E] bg-transparent text-[#1A1A2E] hover:bg-gray-100 disabled:opacity-60"
              >
                Load Sample Policies
              </button>
            </div>
          </form>
        </div>

        {/* Loading Spinner Screen */}
        {analyzing && (
          <div className="card p-10 flex flex-col items-center justify-center gap-4 text-center">
            <SpinnerIcon />
            <span className="text-sm font-semibold text-[#6B7280]">Analyzing both policies...</span>
          </div>
        )}

        {/* Results Block */}
        {result && !analyzing && (
          <div className="flex flex-col gap-10 animate-fade-in">
            
            {/* Section 2: Winner Banner */}
            <div className={`border p-6 rounded-2xl text-center shadow-sm ${
              result.winner === 'A' || result.winner === 'A Wins' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              result.winner === 'B' || result.winner === 'B Wins' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <h2 className="serif text-3xl font-bold mb-2">
                {result.winner === 'A' ? `${labelA} Wins 🏆` :
                 result.winner === 'B' ? `${labelB} Wins 🏆` :
                 "It's a Tie ⚖️"}
              </h2>
              <p className="text-sm opacity-90 leading-relaxed font-medium max-w-2xl mx-auto">
                {result.winner_reason}
              </p>
            </div>

            {/* Section 3: Grade Cards (side by side) */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Policy A Grade */}
              <div className="card p-6 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider mb-0.5">Policy A</span>
                    <h3 className="serif text-lg font-bold text-[#1A1A2E]">{labelA}</h3>
                  </div>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold border-2 shrink-0 shadow-sm"
                    style={{
                      background: (GRADE_STYLES[result.grades.policy_a] ?? GRADE_STYLES.F).bg,
                      color: (GRADE_STYLES[result.grades.policy_a] ?? GRADE_STYLES.F).text,
                      borderColor: (GRADE_STYLES[result.grades.policy_a] ?? GRADE_STYLES.F).border,
                    }}
                  >
                    {result.grades.policy_a}
                  </div>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed mt-2">
                  {result.summary.policy_a}
                </p>
              </div>

              {/* Policy B Grade */}
              <div className="card p-6 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider mb-0.5">Policy B</span>
                    <h3 className="serif text-lg font-bold text-[#1A1A2E]">{labelB}</h3>
                  </div>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold border-2 shrink-0 shadow-sm"
                    style={{
                      background: (GRADE_STYLES[result.grades.policy_b] ?? GRADE_STYLES.F).bg,
                      color: (GRADE_STYLES[result.grades.policy_b] ?? GRADE_STYLES.F).text,
                      borderColor: (GRADE_STYLES[result.grades.policy_b] ?? GRADE_STYLES.F).border,
                    }}
                  >
                    {result.grades.policy_b}
                  </div>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed mt-2">
                  {result.summary.policy_b}
                </p>
              </div>
            </div>

            {/* Section 4: Comparison Table */}
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-[#E5E0D8] bg-[#F9F8F6]">
                <h3 className="font-bold text-[#1A1A2E] uppercase tracking-wider text-[10px]">Comparison Matrix</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#E5E0D8] text-[10px] uppercase font-bold text-[#6B7280] tracking-wider">
                      <th className="p-4 w-1/4">Category</th>
                      <th className="p-4 w-1/3">{labelA}</th>
                      <th className="p-4 w-1/3">{labelB}</th>
                      <th className="p-4 w-12 text-center">Winner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D8]">
                    {result.comparison.map((row: any, idx: number) => {
                      const isHigh = row.importance === 'High';
                      
                      const isWinnerA = row.winner === 'A';
                      const isWinnerB = row.winner === 'B';
                      
                      return (
                        <tr key={idx} className={isHigh ? 'font-bold' : ''}>
                          <td className="p-4 text-[#1A1A2E] bg-gray-50">
                            {row.category}
                            {isHigh && (
                              <span className="ml-2 text-[9px] uppercase font-bold bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                                High
                              </span>
                            )}
                          </td>
                          <td className={`p-4 leading-relaxed ${isWinnerA ? 'bg-emerald-50/40 text-emerald-900' : isWinnerB ? 'bg-red-50/20 text-gray-600' : ''}`}>
                            {row.policy_a}
                          </td>
                          <td className={`p-4 leading-relaxed ${isWinnerB ? 'bg-emerald-50/40 text-emerald-900' : isWinnerA ? 'bg-red-50/20 text-gray-600' : ''}`}>
                            {row.policy_b}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`pill font-bold text-[10px] uppercase ${
                              isWinnerA ? 'pill-green' : isWinnerB ? 'pill-green' : 'pill-amber'
                            }`}>
                              {row.winner === 'A' ? 'A ✓' : row.winner === 'B' ? 'B ✓' : 'Tie'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 5: Pros & Cons */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Policy A Pros/Cons */}
              <div className="card p-6 flex flex-col gap-4">
                <h3 className="serif text-lg font-bold text-[#1A1A2E] mb-1">{labelA} Pros & Cons</h3>
                <div className="flex flex-col gap-2.5">
                  {result.policy_a_pros.map((pro: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs text-[#065f46] font-medium items-start">
                      <span className="shrink-0 text-sm leading-none mt-0.5">✅</span>
                      <span>{pro}</span>
                    </div>
                  ))}
                  {result.policy_a_cons.map((con: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs text-[#991b1b] font-medium items-start">
                      <span className="shrink-0 text-sm leading-none mt-0.5">❌</span>
                      <span>{con}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy B Pros/Cons */}
              <div className="card p-6 flex flex-col gap-4">
                <h3 className="serif text-lg font-bold text-[#1A1A2E] mb-1">{labelB} Pros & Cons</h3>
                <div className="flex flex-col gap-2.5">
                  {result.policy_b_pros.map((pro: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs text-[#065f46] font-medium items-start">
                      <span className="shrink-0 text-sm leading-none mt-0.5">✅</span>
                      <span>{pro}</span>
                    </div>
                  ))}
                  {result.policy_b_cons.map((con: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs text-[#991b1b] font-medium items-start">
                      <span className="shrink-0 text-sm leading-none mt-0.5">❌</span>
                      <span>{con}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 6: Gotchas */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Policy A Gotchas */}
              <div className="card p-6">
                <h3 className="font-bold text-[#1A1A2E] uppercase tracking-wider text-[10px] mb-4 flex items-center gap-1.5">
                  <span>⚠️</span> {labelA} Trap Clauses
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.gotchas.policy_a && result.gotchas.policy_a.length > 0 ? (
                    result.gotchas.policy_a.map((g: string, i: number) => (
                      <span key={i} className="pill pill-amber font-medium text-xs leading-normal select-all">
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#6B7280] italic">No critical trap clauses identified.</span>
                  )}
                </div>
              </div>

              {/* Policy B Gotchas */}
              <div className="card p-6">
                <h3 className="font-bold text-[#1A1A2E] uppercase tracking-wider text-[10px] mb-4 flex items-center gap-1.5">
                  <span>⚠️</span> {labelB} Trap Clauses
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.gotchas.policy_b && result.gotchas.policy_b.length > 0 ? (
                    result.gotchas.policy_b.map((g: string, i: number) => (
                      <span key={i} className="pill pill-amber font-medium text-xs leading-normal select-all">
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#6B7280] italic">No critical trap clauses identified.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 7: Recommendation */}
            <div className="card p-8 text-white relative overflow-hidden" style={{ background: '#1A1A2E' }}>
              <div className="absolute right-0 bottom-0 text-[120px] leading-none opacity-5 select-none pointer-events-none serif">
                “
              </div>
              <h3 className="serif text-xl font-bold mb-3">Our Recommendation</h3>
              <p className="text-sm text-gray-200 leading-relaxed font-medium">
                {result.recommendation}
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default Compare;
