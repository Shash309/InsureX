import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePolicy } from '../hooks/usePolicy';
import { Policy, PolicyStatus } from '../types';

interface ClaimProps {
  account: string | null;
  provider: any;
  signer: any;
}

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const Confetti: React.FC = () => {
  const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#EC4899', '#8B5CF6'];
  const pieces = Array.from({ length: 80 }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 5;
    const duration = 3 + Math.random() * 3;
    const size = 6 + Math.random() * 8;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = Math.random() > 0.5 ? 'rounded-full' : 'rounded-sm';
    return { id: i, left, delay, duration, size, color, shape };
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className={`absolute top-[-20px] ${p.shape} animate-fall`}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: 0.8,
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
          }
        }
        .animate-fall {
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
};

export const Claim: React.FC<ClaimProps> = ({ account, provider, signer }) => {
  const [searchParams]  = useSearchParams();
  const preselectedId   = searchParams.get('policyId') ? Number(searchParams.get('policyId')) : null;

  const { getPolicies, fileClaim, getClaimStatus, loading, error } = usePolicy(provider, signer, account);

  const [policies, setPolicies]                 = useState<Policy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(preselectedId);
  const [actionStatus, setActionStatus]         = useState<string | null>(null);
  const [successMessage, setSuccessMessage]     = useState<string | null>(null);
  const [localError, setLocalError]             = useState<string | null>(null);
  const [claimDesc, setClaimDesc]               = useState('');
  const [claimAmount, setClaimAmount]           = useState('');
  const [showConfetti, setShowConfetti]         = useState(false);
  const [currentStep, setCurrentStep]           = useState<number>(1);

  const [weatherCity, setWeatherCity]           = useState('Mumbai');
  const [weatherThreshold, setWeatherThreshold] = useState('30');
  const [weatherOperator, setWeatherOperator]   = useState('less_than');
  const [flightNumber, setFlightNumber]         = useState('AI302');
  const [flightThreshold, setFlightThreshold]   = useState('180');
  const [oracleResult, setOracleResult]         = useState<any | null>(null);

  const fetchActivePolicies = async () => {
    if (!account) return;
    try {
      const list = await getPolicies();
      // Show Active policies OR the currently selected policy
      setPolicies(list.filter(p => p.status === PolicyStatus.Active || p.tokenId === selectedPolicyId));
    } catch (e) { console.error(e); }
  };

  const fetchClaimStatus = async () => {
    if (selectedPolicyId === null) {
      setCurrentStep(1);
      return;
    }
    try {
      const status = await getClaimStatus(selectedPolicyId);
      if (status === 1) { // Pending
        setCurrentStep(3);
      } else if (status === 4) { // Paid/Claimed
        setCurrentStep(5);
      } else {
        setCurrentStep(2); // Selected but not filed
      }
    } catch (e) {
      console.error(e);
      setCurrentStep(2);
    }
  };

  useEffect(() => {
    fetchClaimStatus();
    setOracleResult(null);
  }, [selectedPolicyId, account]);

  useEffect(() => { fetchActivePolicies(); }, [account]);

  // Pre-select from URL param once policies are loaded
  useEffect(() => {
    if (preselectedId && policies.some(p => p.tokenId === preselectedId)) {
      setSelectedPolicyId(preselectedId);
    }
  }, [policies, preselectedId]);

  const selectedPolicy = policies.find(p => p.tokenId === selectedPolicyId);

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPolicyId === null || !selectedPolicy) return;

    setActionStatus('Submitting claim transaction on-chain…');
    setSuccessMessage(null);
    setLocalError(null);

    try {
      await fileClaim(
        selectedPolicyId,
        claimDesc || 'Claim filed via InsureX portal',
        claimAmount || '0',
        ''
      );
      setSuccessMessage(`Claim filed for policy #${String(selectedPolicyId).padStart(4,'0')}. Awaiting oracle evaluation.`);
      setCurrentStep(3); // Move to Step 3: Oracle Verify
      setActionStatus(null);
      await fetchActivePolicies();
      await fetchClaimStatus();
    } catch (err: any) {
      setActionStatus(null);
      setLocalError(err.message || 'Failed to file claim');
    }
  };

  const handleTriggerOraclePayout = async () => {
    if (selectedPolicyId === null) return;

    setActionStatus('Contacting oracle service for payout settlement…');
    setSuccessMessage(null);
    setLocalError(null);

    try {
      const response = await fetch("http://localhost:8000/oracle/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy_token_id: selectedPolicyId })
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage("Claim approved and paid out! The payout has been sent directly to your wallet.");
        setCurrentStep(5); // Step 3 & 4 both complete
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 8000);
        setActionStatus(null);
        await fetchActivePolicies();
        await fetchClaimStatus();
      } else {
        throw new Error(result.detail || "Oracle payout simulation failed");
      }
    } catch (err: any) {
      console.error(err);
      setActionStatus(null);
      setLocalError(err.message || "Failed to contact oracle or execute payout.");
    }
  };

  const handleWeatherOracleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPolicyId === null) return;

    setActionStatus('Checking real-time weather and verifying claim…');
    setSuccessMessage(null);
    setLocalError(null);
    setOracleResult(null);

    try {
      const response = await fetch("http://localhost:8000/oracle/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_token_id: selectedPolicyId,
          city: weatherCity,
          threshold_mm: parseFloat(weatherThreshold),
          operator: weatherOperator
        })
      });
      const result = await response.json();
      if (response.ok) {
        setOracleResult({
          type: 'weather',
          actual: result.actual_value,
          threshold: result.threshold,
          verdict: result.verdict,
          reason: result.reason,
          tx_hash: result.blockchain_tx?.tx_hash,
          data: result
        });
        
        if (result.condition_met) {
          setSuccessMessage("Weather condition met! Claim approved and paid out.");
          setCurrentStep(5); // Step 3 & 4 complete
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 8000);
        } else {
          setLocalError("Claim rejected: " + result.reason);
          setCurrentStep(4); // Oracle verified but not paid
        }
        await fetchActivePolicies();
        await fetchClaimStatus();
      } else {
        throw new Error(result.detail || "Weather oracle verification failed");
      }
    } catch (err: any) {
      console.error(err);
      setLocalError(err.message || "Failed to settle weather claim.");
    } finally {
      setActionStatus(null);
    }
  };

  const handleFlightOracleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPolicyId === null) return;

    setActionStatus('Checking real-time flight status and verifying claim…');
    setSuccessMessage(null);
    setLocalError(null);
    setOracleResult(null);

    try {
      const response = await fetch("http://localhost:8000/oracle/flight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_token_id: selectedPolicyId,
          flight_number: flightNumber,
          threshold_minutes: parseInt(flightThreshold, 10)
        })
      });
      const result = await response.json();
      if (response.ok) {
        setOracleResult({
          type: 'flight',
          actual: result.delay_minutes,
          threshold: result.threshold_minutes,
          verdict: result.verdict,
          reason: result.reason,
          tx_hash: result.blockchain_tx?.tx_hash,
          data: result
        });
        
        if (result.condition_met) {
          setSuccessMessage("Flight delay condition met! Claim approved and paid out.");
          setCurrentStep(5); // Step 3 & 4 complete
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 8000);
        } else {
          setLocalError("Claim rejected: " + result.reason);
          setCurrentStep(4); // Oracle verified but not paid
        }
        await fetchActivePolicies();
        await fetchClaimStatus();
      } else {
        throw new Error(result.detail || "Flight oracle verification failed");
      }
    } catch (err: any) {
      console.error(err);
      setLocalError(err.message || "Failed to settle flight claim.");
    } finally {
      setActionStatus(null);
    }
  };

  const inputCls = "w-full border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-sm text-[#1A1A2E] bg-white focus:outline-none focus:border-[#2563EB] transition-colors";
  const labelCls = "block text-[10px] uppercase font-bold text-[#6B7280] tracking-wider mb-1.5";

  return (
    <div className="bg-[#F8F6F1] dot-grid min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-10 text-center">
          <span className="pill pill-orange mb-4">Claim Portal</span>
          <h1 className="serif text-4xl md:text-5xl mb-3" style={{ color: '#1A1A2E', opacity: 1 }}>
            File a Parametric Claim
          </h1>
          <p className="text-[#6B7280] max-w-lg mx-auto text-sm md:text-base">
            Select an active policy, describe the event, then run the oracle simulation to settle instantly.
          </p>
        </div>

        {/* Not connected */}
        {!account ? (
          <div className="card max-w-sm mx-auto p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F0EDE6] flex items-center justify-center text-2xl mb-5">🔒</div>
            <h2 className="serif text-xl mb-2" style={{ color: '#1A1A2E' }}>Wallet not connected</h2>
            <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
              Connect MetaMask to select a policy and file a claim.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* Alerts */}
            {(error || localError) && (
              <div className="flex gap-3 items-start bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
                <span className="mt-0.5 shrink-0">⚠</span>
                <div><strong>Error:</strong> {error || localError}</div>
              </div>
            )}
            {actionStatus && (
              <div className="flex gap-3 items-center bg-blue-50 border border-blue-200 text-[#2563EB] rounded-xl p-4 text-sm">
                <SpinnerIcon /> {actionStatus}
              </div>
            )}
            {successMessage && (
              <div className="flex gap-3 items-start bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm">
                <span className="mt-0.5 shrink-0">✓</span>
                <div>{successMessage}</div>
              </div>
            )}

            {/* Step 1: Select Policy */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1A1A2E' }}>1</div>
                <h2 className="serif text-xl font-semibold" style={{ color: '#1A1A2E' }}>Select Active Policy</h2>
              </div>

              {policies.length === 0 ? (
                <div className="text-center py-6 text-sm text-[#6B7280]">
                  No active policy NFTs found.{' '}
                  <Link to="/dashboard" className="text-[#2563EB] underline underline-offset-2">
                    Mint one on the Dashboard.
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {policies.map(policy => {
                    const selected = selectedPolicyId === policy.tokenId;
                    return (
                      <button
                        key={policy.tokenId}
                        onClick={() => { setSelectedPolicyId(policy.tokenId); setSuccessMessage(null); setCurrentStep(2); }}
                        className={`text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                          selected
                            ? 'border-[#2563EB] bg-blue-50'
                            : 'border-[#E5E0D8] bg-white hover:border-[#2563EB]/40'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="mono text-xs text-[#6B7280]">
                            #{String(policy.tokenId).padStart(4, '0')}
                          </span>
                          <span className="pill pill-blue text-[9px]">Active</span>
                        </div>
                        <div className="text-sm font-semibold capitalize mb-1" style={{ color: '#1A1A2E' }}>
                          {policy.policyType}
                        </div>
                        <div className="mono text-xs font-bold text-emerald-700">
                          Coverage: {policy.coverageAmount} ETH
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2 & 3 — visible after selection */}
            {selectedPolicy && (
              <div className="grid sm:grid-cols-2 gap-5">

                {/* File Claim */}
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1A1A2E' }}>2</div>
                    <h2 className="serif text-lg font-semibold" style={{ color: '#1A1A2E' }}>File Claim</h2>
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed mb-4">
                    Notify the smart contract that a triggering event occurred.
                    Locks the policy state to "Pending".
                  </p>

                  <form onSubmit={handleFileClaim} className="flex flex-col gap-3">
                    <div>
                      <label className={labelCls}>Description</label>
                      <input
                        type="text"
                        value={claimDesc}
                        onChange={e => setClaimDesc(e.target.value)}
                        className={inputCls}
                        placeholder="e.g. Flight delayed by 4 hours"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Claim Amount (ETH)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={claimAmount}
                        onChange={e => setClaimAmount(e.target.value)}
                        className={inputCls}
                        placeholder={`max ${selectedPolicy.coverageAmount} ETH`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn w-full justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                      style={{ background: '#1A1A2E', color: '#FFFFFF', opacity: 1 }}
                    >
                      {loading ? <><SpinnerIcon /> Submitting…</> : 'Submit Claim'}
                    </button>
                  </form>
                </div>

                {/* Oracle Settle */}
                <div className="card p-6" style={{ borderColor: '#2563EB', borderWidth: '1px' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#2563EB' }}>3</div>
                    <h2 className="serif text-lg font-semibold" style={{ color: '#1A1A2E' }}>Oracle Settle</h2>
                  </div>

                  {selectedPolicy.policyType.toLowerCase() === 'crop' ? (
                    <form onSubmit={handleWeatherOracleSettle} className="flex flex-col gap-3">
                      <p className="text-xs text-[#6B7280] leading-relaxed mb-1">
                        Settle your Crop Policy instantly by checking real-world rainfall data via OpenWeather oracle.
                      </p>
                      <div>
                        <label className={labelCls}>City Name</label>
                        <input
                          type="text"
                          value={weatherCity}
                          onChange={e => setWeatherCity(e.target.value)}
                          className={inputCls}
                          placeholder="e.g. Mumbai"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Rainfall (mm)</label>
                          <input
                            type="number"
                            value={weatherThreshold}
                            onChange={e => setWeatherThreshold(e.target.value)}
                            className={inputCls}
                            placeholder="Threshold"
                            required
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Operator</label>
                          <select
                            value={weatherOperator}
                            onChange={e => setWeatherOperator(e.target.value)}
                            className={inputCls}
                          >
                            <option value="less_than">Below</option>
                            <option value="greater_than">Above</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn w-full justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                        style={{ background: '#2563EB', color: '#FFFFFF', opacity: 1 }}
                      >
                        {loading ? <><SpinnerIcon /> Checking Weather…</> : 'Check Weather & Settle'}
                      </button>
                    </form>
                  ) : selectedPolicy.policyType.toLowerCase() === 'travel' ? (
                    <form onSubmit={handleFlightOracleSettle} className="flex flex-col gap-3">
                      <p className="text-xs text-[#6B7280] leading-relaxed mb-1">
                        Settle your Travel Policy instantly by checking real-world flight delays via AviationStack.
                      </p>
                      <div>
                        <label className={labelCls}>Flight Number (IATA)</label>
                        <input
                          type="text"
                          value={flightNumber}
                          onChange={e => setFlightNumber(e.target.value)}
                          className={inputCls}
                          placeholder="e.g. AI302"
                          required
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Delay Threshold (Mins)</label>
                        <input
                          type="number"
                          value={flightThreshold}
                          onChange={e => setFlightThreshold(e.target.value)}
                          className={inputCls}
                          placeholder="e.g. 180"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn w-full justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                        style={{ background: '#2563EB', color: '#FFFFFF', opacity: 1 }}
                      >
                        {loading ? <><SpinnerIcon /> Checking Flight…</> : 'Check Flight & Settle'}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-[#6B7280] leading-relaxed mb-1">
                        Trigger automated parametric claim payout. This service signs the transaction on-chain as the trusted oracle.
                      </p>
                      <button
                        type="button"
                        onClick={handleTriggerOraclePayout}
                        disabled={loading}
                        className="btn w-full justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                        style={{ background: '#2563EB', color: '#FFFFFF', opacity: 1 }}
                      >
                        {loading ? <><SpinnerIcon /> Executing Payout…</> : 'Trigger Oracle Payout'}
                      </button>
                    </div>
                  )}

                  {/* Oracle Results Section */}
                  {oracleResult && (
                    <div className="mt-5 p-4 rounded-xl border border-[#E5E0D8] bg-[#F9F8F6] text-xs">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-[#1A1A2E] uppercase tracking-wider text-[9px]">Oracle Feed Results</span>
                        <span className={`pill text-[9px] uppercase font-bold ${
                          oracleResult.verdict === 'APPROVE' ? 'pill-green' : 'pill-red'
                        }`}>
                          {oracleResult.verdict}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 text-[#6B7280] font-medium">
                        <div className="flex justify-between">
                          <span>Threshold Value:</span>
                          <span className="text-[#1A1A2E] font-bold">
                            {oracleResult.threshold} {oracleResult.type === 'weather' ? 'mm' : 'minutes'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Actual Feed Value:</span>
                          <span className="text-[#1A1A2E] font-bold">
                            {oracleResult.actual} {oracleResult.type === 'weather' ? 'mm' : 'minutes'}
                          </span>
                        </div>
                        {oracleResult.verdict === 'APPROVE' ? (
                          <div className="mt-2 pt-2 border-t border-[#E5E0D8]">
                            <div className="text-emerald-700 font-bold mb-1">✓ Claim Automatically Approved & Paid Out!</div>
                            {oracleResult.tx_hash && (
                              <div className="mono text-[10px] break-all select-all">
                                Tx: <span className="underline">{oracleResult.tx_hash}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 pt-2 border-t border-[#E5E0D8]">
                            <div className="text-red-700 font-bold">✗ Claim Rejected</div>
                            <div className="text-[11px] leading-relaxed mt-1 text-[#6B7280]">
                              Reason: {oracleResult.reason}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Progress tracker */}
            <div className="card p-5 bg-[#F0EDE6] border-[#E5E0D8]">
              <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-4">Claim Progress</h4>
              <div className="flex items-center gap-0">
                {[
                  { n: 1, label: 'Select Policy', done: currentStep >= 2 },
                  { n: 2, label: 'File Claim',    done: currentStep >= 3 },
                  { n: 3, label: 'Oracle Verify', done: currentStep >= 4 },
                  { n: 4, label: 'Auto Payout',   done: currentStep >= 5 },
                ].map(({ n, label, done }, idx) => (
                  <React.Fragment key={n}>
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-white border-[#E5E0D8] text-[#6B7280]'
                      }`}>
                        {done ? '✓' : n}
                      </div>
                      <span className="text-[9px] text-center font-semibold text-[#6B7280] uppercase tracking-wide leading-tight">{label}</span>
                    </div>
                    {idx < 3 && <div className="h-0.5 bg-[#E5E0D8] flex-1 mb-4" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {showConfetti && <Confetti />}
    </div>
  );
};

export default Claim;
