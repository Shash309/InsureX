import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plane, Heart, Leaf, Car, Shield, Upload, FileText, AlertTriangle, Check, X, CloudRain, Zap, CheckCircle2, Paperclip, CheckCircle, XCircle, Search } from 'lucide-react';
import { usePolicy } from '../hooks/usePolicy';
import { Policy, PolicyStatus } from '../types';
import { API_URL } from '../config/env';

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

const getPolicyTypeLabel = (type: string | number) => {
  const typeMap: { [key: string]: string } = {
    "0": "Travel",
    "1": "Health", 
    "2": "Crop",
    "3": "Auto",
    "travel": "Travel",
    "health": "Health",
    "crop": "Crop",
    "auto": "Auto"
  };
  return typeMap[String(type).toLowerCase()] || String(type);
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

  // Step 2.5 Evidence States
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceResult, setEvidenceResult] = useState<any>(null);
  const [verifyingEvidence, setVerifyingEvidence] = useState(false);
  const [evidenceSkipped, setEvidenceSkipped] = useState(false);
  const [activeEvidenceTab, setActiveEvidenceTab] = useState("text");

  const resetEvidenceState = () => {
    setEvidenceFile(null);
    setEvidenceText('');
    setEvidenceResult(null);
    setEvidenceSkipped(false);
    setActiveEvidenceTab("text");
  };

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
        setEvidenceSkipped(true);
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
    resetEvidenceState();
  }, [selectedPolicyId, account]);

  useEffect(() => { fetchActivePolicies(); }, [account]);

  // Pre-select from URL param once policies are loaded
  useEffect(() => {
    if (preselectedId && policies.some(p => p.tokenId === preselectedId)) {
      setSelectedPolicyId(preselectedId);
    }
  }, [policies, preselectedId]);

  const selectedPolicy = policies.find(p => p.tokenId === selectedPolicyId);

  const description = claimDesc;

  const verifyEvidence = async () => {
    if (!selectedPolicy) return
    setVerifyingEvidence(true)
    
    try {
      let result
      
      if (activeEvidenceTab === "file" && evidenceFile) {
        const formData = new FormData()
        formData.append("file", evidenceFile)
        formData.append("claim_description", description)
        formData.append("policy_type", selectedPolicy.policyType)
        formData.append("claim_amount_eth", claimAmount)
        
        const res = await fetch(`${API_URL}/evidence/verify-image`, {
          method: "POST",
          body: formData
        })
        result = await res.json()
      } else {
        const res = await fetch(`${API_URL}/evidence/verify-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claim_description: description,
            policy_type: selectedPolicy.policyType,
            claim_amount_eth: parseFloat(claimAmount),
            evidence_text: evidenceText
          })
        })
        result = await res.json()
      }
      
      setEvidenceResult(result)
    } catch (err) {
      console.error("Evidence verification error:", err)
    } finally {
      setVerifyingEvidence(false)
    }
  }

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPolicyId === null || !selectedPolicy) return;

    setActionStatus('Submitting claim transaction on-chainâ€¦');
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

    setActionStatus('Contacting oracle service for payout settlementâ€¦');
    setSuccessMessage(null);
    setLocalError(null);

    try {
      const response = await fetch(`${API_URL}/oracle/settle`, {
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

    setActionStatus('Checking real-time weather and verifying claimâ€¦');
    setSuccessMessage(null);
    setLocalError(null);
    setOracleResult(null);

    try {
      const response = await fetch(`${API_URL}/oracle/weather`, {
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

    setActionStatus('Checking real-time flight status and verifying claimâ€¦');
    setSuccessMessage(null);
    setLocalError(null);
    setOracleResult(null);

    try {
      const response = await fetch(`${API_URL}/oracle/flight`, {
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

  type PolicyAccent = { border: string; bg: string; iconBg: string; iconColor: string; IconComponent: React.ElementType };
  const policyAccent: Record<string, PolicyAccent> = {
    travel:  { border: '#3B82F6', bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', IconComponent: Plane },
    health:  { border: '#10B981', bg: '#F0FDF4', iconBg: '#D1FAE5', iconColor: '#059669', IconComponent: Heart },
    crop:    { border: '#F59E0B', bg: '#FFFBEB', iconBg: '#FEF3C7', iconColor: '#D97706', IconComponent: Leaf },
    auto:    { border: '#8B5CF6', bg: '#F5F3FF', iconBg: '#EDE9FE', iconColor: '#7C3AED', IconComponent: Car },
  };
  const getAccent = (type: string | number): PolicyAccent => {
    const label = getPolicyTypeLabel(type).toLowerCase();
    return policyAccent[label] ?? { border: '#6B7280', bg: '#F9FAFB', iconBg: '#F3F4F6', iconColor: '#6B7280', IconComponent: Shield };
  };
  const inputCls = "w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm text-[#1A1A2E] bg-white focus:outline-none focus:border-[#2563EB] transition-colors placeholder:text-[#9CA3AF]";
  const labelCls = "block text-[11px] uppercase font-bold text-[#6B7280] tracking-wider mb-1.5";

  return (
    <div className="bg-[#F8F6F1] dot-grid min-h-screen pt-28 pb-36 px-4 md:px-6">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* â”€â”€ Header â”€â”€ */}
        <div className="mb-10 text-center">
          <span className="pill pill-orange mb-4">Claim Portal</span>
          <h1 className="serif text-4xl md:text-5xl mb-3" style={{ color: '#1A1A2E' }}>
            File a Parametric Claim
          </h1>
          <p className="text-[#6B7280] max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Select an active policy, describe the event, then run the oracle simulation to settle instantly.
          </p>
        </div>

        {/* â”€â”€ Not connected â”€â”€ */}
        {!account ? (
          <div style={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 40 }}
            className="max-w-sm mx-auto flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F0EDE6] flex items-center justify-center mb-5"><Shield size={28} color="#1A1A2E" /></div>
            <h2 className="serif text-xl mb-2" style={{ color: '#1A1A2E' }}>Wallet not connected</h2>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Connect MetaMask to select a policy and file a claim.
            </p>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 24 }}>

            {/* â”€â”€ Alerts â”€â”€ */}
            {(error || localError) && (
              <div className="flex gap-3 items-start bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div><strong>Error:</strong> {error || localError}</div>
              </div>
            )}
            {actionStatus && (
              <div className="flex gap-3 items-center bg-blue-50 border border-blue-200 text-[#2563EB] rounded-2xl p-4 text-sm">
                <SpinnerIcon /> {actionStatus}
              </div>
            )}
            {successMessage && (
              <div className="flex gap-3 items-start bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>{successMessage}</div>
              </div>
            )}

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                STEP 1 â€” SELECT POLICY
            â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            <div style={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 28 }}>
              <div className="flex items-center gap-4 mb-6">
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>1</div>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#1A1A2E', fontWeight: 700, lineHeight: 1.2 }}>
                    Select Active Policy
                  </h2>
                  <p style={{ fontSize: 14, color: '#4B5563', marginTop: 2 }}>Choose the policy you want to file a claim against</p>
                </div>
              </div>

              {policies.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#6B7280]">
                  <div className="flex justify-center mb-3"><FileText size={40} color="#D1D5DB" /></div>
                  No active policy NFTs found.{' '}
                  <Link to="/dashboard" className="text-[#2563EB] underline underline-offset-2 font-semibold">
                    Mint one on the Dashboard.
                  </Link>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                  {policies.map(policy => {
                    const selected = selectedPolicyId === policy.tokenId;
                    const accent = getAccent(policy.policyType);
                    return (
                      <button
                        key={policy.tokenId}
                        onClick={() => { setSelectedPolicyId(policy.tokenId); setSuccessMessage(null); setCurrentStep(2); }}
                        style={{
                          minWidth: 200, flexShrink: 0,
                          borderLeft: `4px solid ${accent.border}`,
                          border: selected ? `2px solid #1A1A2E` : `1px solid #E5E0D8`,
                          borderLeftWidth: 4, borderLeftColor: accent.border,
                          background: selected ? '#F0F4FF' : '#fff',
                          borderRadius: 14, padding: '18px 16px', textAlign: 'left',
                          transition: 'all 0.15s', cursor: 'pointer',
                          boxShadow: selected ? '0 2px 8px rgba(37,99,235,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: accent.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                          <accent.IconComponent size={20} color={accent.iconColor} />
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace', marginBottom: 4 }}>
                          #{String(policy.tokenId).padStart(4, '0')}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', textTransform: 'capitalize', marginBottom: 6 }}>
                          {getPolicyTypeLabel(policy.policyType)} Policy
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', fontFamily: 'monospace', marginBottom: 8 }}>
                          {policy.coverageAmount} ETH
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                          Active
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Steps 2/2.5/3 only shown after policy is selected */}
            {selectedPolicy && (
              <>

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    STEP 2 â€” FILE CLAIM
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                <div style={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 28 }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>2</div>
                    <div>
                      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#1A1A2E', fontWeight: 700, lineHeight: 1.2 }}>File Claim</h2>
                      <p style={{ fontSize: 14, color: '#4B5563', marginTop: 2 }}>Notify the smart contract of the triggering event</p>
                    </div>
                  </div>

                  <form onSubmit={handleFileClaim}>
                    <div className="grid md:grid-cols-2 gap-5">
                      {/* Left: Description */}
                      <div className="flex flex-col">
                        <label className={labelCls}>Claim Description</label>
                        <textarea
                          value={claimDesc}
                          onChange={e => setClaimDesc(e.target.value)}
                          className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm text-[#1A1A2E] bg-white focus:outline-none focus:border-[#2563EB] transition-colors resize-none placeholder:text-[#9CA3AF]"
                          placeholder="e.g. Flight AI302 was delayed by 4 hours due to weather conditions"
                          rows={5}
                          style={{ flex: 1 }}
                        />
                      </div>

                      {/* Right: Amount + submit */}
                      <div className="flex flex-col gap-4">
                        <div>
                          <label className={labelCls}>Claim Amount</label>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              step="0.001"
                              value={claimAmount}
                              onChange={e => setClaimAmount(e.target.value)}
                              className={`${inputCls} pr-12`}
                              placeholder="0.00"
                            />
                            <span className="absolute right-4 text-sm font-bold text-[#6B7280]">ETH</span>
                          </div>
                          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
                            Max claimable:{' '}
                            <span style={{ fontWeight: 700, color: '#059669' }}>{selectedPolicy.coverageAmount} ETH</span>
                          </p>
                        </div>

                        <div className="mt-auto">
                          {(evidenceResult?.verdict === 'APPROVE' || evidenceSkipped) ? (
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                              style={{ background: '#1A1A2E', color: '#fff' }}
                            >
                              {loading ? <><SpinnerIcon /> Submitting...</> : 'Submit Claim On-Chain'}
                            </button>
                          ) : (
                            <div style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                              <p style={{ fontSize: 12, color: '#6B7280' }}>
                                Complete <strong>Step 2.5</strong> â€” verify or skip evidence â€” to unlock submission.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    STEP 2.5 â€” EVIDENCE
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                <div style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 28 }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>2.5</div>
                    <div>
                      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#1A1A2E', fontWeight: 700, lineHeight: 1.2 }}>Evidence &amp; Verification</h2>
                      <p style={{ fontSize: 14, color: '#4B5563', marginTop: 2 }}>Provide supporting proof â€” AI evaluates it instantly</p>
                    </div>
                  </div>

                  {/* Pill tabs */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#F3F4F6', borderRadius: 12, padding: 4 }}>
                    {(['text', 'file'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveEvidenceTab(tab)}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
                          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                          background: activeEvidenceTab === tab ? '#fff' : 'transparent',
                          color: activeEvidenceTab === tab ? '#1A1A2E' : '#6B7280',
                          boxShadow: activeEvidenceTab === tab ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                        }}
                      >
                        {tab === 'text' ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <FileText size={14} />
                            Describe Evidence
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5">
                            <Paperclip size={14} />
                            Upload File
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Text tab */}
                  {activeEvidenceTab === 'text' && (
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={evidenceText}
                        onChange={e => setEvidenceText(e.target.value)}
                        placeholder="Describe your evidence clearly, e.g. 'Hospital bill from Apollo, dated Jan 15, showing â‚¹45,000 for appendectomy surgery'"
                        rows={5}
                        className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:border-[#2563EB] transition-colors text-[#1A1A2E] bg-white placeholder:text-[#9CA3AF]"
                      />
                      <span style={{ position: 'absolute', bottom: 10, right: 14, fontSize: 11, color: '#9CA3AF' }}>
                        {evidenceText.length} chars
                      </span>
                    </div>
                  )}

                  {/* File tab */}
                  {activeEvidenceTab === 'file' && (
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      border: `2px dashed ${evidenceFile ? '#10B981' : '#D1D5DB'}`,
                      borderRadius: 14, padding: '36px 20px', textAlign: 'center',
                      background: evidenceFile ? '#F0FDF4' : '#FAFAFA', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={e => setEvidenceFile(e.target.files ? e.target.files[0] : null)}
                        style={{ display: 'none' }}
                      />
                      {evidenceFile ? (
                        <>
                          <div style={{ marginBottom: 8 }}><CheckCircle size={36} color="green" /></div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>{evidenceFile.name}</p>
                          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                            {(evidenceFile.size / 1024).toFixed(1)} KB — click to change
                          </p>
                        </>
                      ) : (
                        <>
                          <div style={{ marginBottom: 10 }}><Upload size={40} color="#9CA3AF" /></div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>Drop file here or click to browse</p>
                          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Accepts PDF, PNG, JPG up to 5 MB</p>
                        </>
                      )}
                    </label>
                  )}

                  {/* Verify button */}
                  <button
                    type="button"
                    onClick={verifyEvidence}
                    disabled={verifyingEvidence}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-4"
                    style={{ background: '#2563EB', color: '#fff' }}
                  >
                    {verifyingEvidence ? (
                      <><SpinnerIcon /> AI Analyzing Evidence...</>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <Search size={14} />
                        Verify Evidence
                      </span>
                    )}
                  </button>

                  {/* Evidence result */}
                  {evidenceResult && (
                    <div className="mt-5 animate-fade-in">
                      {evidenceResult.verdict === 'APPROVE' && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #6EE7B7', borderRadius: 14, padding: '16px 18px' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CheckCircle size={16} color="green" style={{ flexShrink: 0 }} />
                              {" "}Evidence Verified — Claim Supported
                            </span>
                            <span style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {evidenceResult.confidence}% Confident
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: '#047857', marginBottom: 10 }}>{evidenceResult.reason}</p>
                          <div className="flex flex-wrap gap-2">
                            {evidenceResult.supporting_elements?.map((s: string, i: number) => (
                              <span key={i} style={{ background: '#D1FAE5', color: '#065F46', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={10} style={{ flexShrink: 0 }} />
                              {" "}{s}
                            </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {evidenceResult.verdict === 'REJECT' && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 14, padding: '16px 18px' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#7F1D1D', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <XCircle size={16} color="red" style={{ flexShrink: 0 }} />
                            {" "}Evidence Rejected
                          </div>
                          <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 10 }}>{evidenceResult.reason}</p>
                          <div className="flex flex-wrap gap-2">
                            {evidenceResult.red_flags?.map((f: string, i: number) => (
                              <span key={i} style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={10} style={{ flexShrink: 0 }} />
                              {" "}{f}
                            </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {evidenceResult.verdict === 'MANUAL_REVIEW' && (
                        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 14, padding: '16px 18px' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#78350F', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={16} color="orange" style={{ flexShrink: 0 }} />
                            {" "}Manual Review Required
                          </div>
                          <p style={{ fontSize: 13, color: '#B45309' }}>{evidenceResult.reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Skip link */}
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setEvidenceSkipped(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF' }}
                      className="hover:text-[#6B7280] transition-colors"
                    >
                      Skip Evidence (may affect claim approval)
                    </button>
                  </div>
                </div>

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    STEP 3 â€” ORACLE SETTLE
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                {(evidenceResult?.verdict === 'APPROVE' || evidenceSkipped) && (
                  <div style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: 28 }}>
                    <div className="flex items-center gap-4 mb-6">
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>3</div>
                      <div>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#1A1A2E', fontWeight: 700, lineHeight: 1.2 }}>Oracle Settle</h2>
                        <p style={{ fontSize: 14, color: '#4B5563', marginTop: 2 }}>Trigger real-time data verification &amp; automatic payout</p>
                      </div>
                    </div>

                    {selectedPolicy.policyType.toLowerCase() === 'crop' ? (
                      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 14, padding: 22 }}>
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CloudRain size={16} style={{ flexShrink: 0 }} />
                              {" "}Weather Oracle
                            </div>
                            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Settle via real-time OpenWeather rainfall data</p>
                          </div>
                          <CloudRain size={32} color="#BAE6FD" />
                        </div>
                        <form onSubmit={handleWeatherOracleSettle} className="flex flex-col gap-3">
                          <div>
                            <label className={labelCls}>City Name</label>
                            <input type="text" value={weatherCity} onChange={e => setWeatherCity(e.target.value)} className={inputCls} placeholder="e.g. Mumbai" required />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelCls}>Rainfall Threshold</label>
                              <div style={{ position: 'relative' }}>
                                <input type="number" value={weatherThreshold} onChange={e => setWeatherThreshold(e.target.value)} className={inputCls} style={{ paddingRight: 44 }} placeholder="30" required />
                                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#6B7280', fontWeight: 700 }}>mm</span>
                              </div>
                            </div>
                            <div>
                              <label className={labelCls}>Operator</label>
                              <select value={weatherOperator} onChange={e => setWeatherOperator(e.target.value)} className={inputCls}>
                                <option value="less_than">Below threshold</option>
                                <option value="greater_than">Above threshold</option>
                              </select>
                            </div>
                          </div>
                          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed mt-1" style={{ background: '#2563EB', color: '#fff' }}>
                            {loading ? <><SpinnerIcon /> Checking Weather…</> : 'Check Weather & Settle'}
                          </button>
                        </form>
                      </div>

                    ) : selectedPolicy.policyType.toLowerCase() === 'travel' ? (
                      <div style={{ background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: 14, padding: 22 }}>
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Plane size={16} style={{ flexShrink: 0 }} />
                              {" "}Flight Oracle
                            </div>
                            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Settle via real-time AviationStack flight data</p>
                          </div>
                          <Plane size={32} color="#C4B5FD" />
                        </div>
                        <form onSubmit={handleFlightOracleSettle} className="flex flex-col gap-3">
                          <div>
                            <label className={labelCls}>Flight Number (IATA)</label>
                            <input type="text" value={flightNumber} onChange={e => setFlightNumber(e.target.value)} className={inputCls} placeholder="e.g. AI302" required />
                          </div>
                          <div>
                            <label className={labelCls}>Delay Threshold (minutes)</label>
                            <input type="number" value={flightThreshold} onChange={e => setFlightThreshold(e.target.value)} className={inputCls} placeholder="e.g. 180" required />
                          </div>
                          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed mt-1" style={{ background: '#2563EB', color: '#fff' }}>
                            {loading ? <><SpinnerIcon /> Checking Flight…</> : 'Check Flight & Settle'}
                          </button>
                        </form>
                      </div>

                    ) : (
                      <div style={{ background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 14, padding: 22 }}>
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Zap size={16} style={{ flexShrink: 0 }} />
                              {" "}Automated Oracle Payout
                            </div>
                            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Signs the parametric payout transaction on-chain as trusted oracle</p>
                          </div>
                          <Zap size={32} color="#A7F3D0" />
                        </div>
                        <button type="button" onClick={handleTriggerOraclePayout} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed" style={{ background: '#2563EB', color: '#fff' }}>
                          {loading ? <><SpinnerIcon /> Executing Payout…</> : 'Trigger Oracle Payout'}
                        </button>
                      </div>
                    )}

                    {/* Oracle Results */}
                    {oracleResult && (
                      <div className="mt-5 animate-fade-in" style={{ background: '#F9F8F6', border: '1px solid #E5E0D8', borderRadius: 14, padding: 20 }}>
                        <div className="flex justify-between items-center mb-4">
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Oracle Feed Results</span>
                          <span style={{ borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 800, background: oracleResult.verdict === 'APPROVE' ? '#D1FAE5' : '#FEE2E2', color: oracleResult.verdict === 'APPROVE' ? '#065F46' : '#7F1D1D' }}>
                            {oracleResult.verdict}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 text-sm">
                          <div className="flex justify-between">
                            <span style={{ color: '#6B7280' }}>Threshold Value</span>
                            <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{oracleResult.threshold} {oracleResult.type === 'weather' ? 'mm' : 'min'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span style={{ color: '#6B7280' }}>Actual Feed Value</span>
                            <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{oracleResult.actual} {oracleResult.type === 'weather' ? 'mm' : 'min'}</span>
                          </div>
                          <div style={{ borderTop: '1px solid #E5E0D8', paddingTop: 10, marginTop: 4 }}>
                            {oracleResult.verdict === 'APPROVE' ? (
                              <>
                                <div style={{ color: '#065F46', fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Check size={14} style={{ flexShrink: 0 }} />
                                  {" "}Claim Automatically Approved &amp; Paid Out!
                                </div>
                                {oracleResult.tx_hash && (
                                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B7280', wordBreak: 'break-all' }}>
                                    Tx: <span style={{ textDecoration: 'underline' }}>{oracleResult.tx_hash}</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div style={{ color: '#991B1B', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <X size={14} style={{ flexShrink: 0 }} />
                                  {" "}Claim Rejected
                                </div>
                                <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>Reason: {oracleResult.reason}</div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          STICKY PROGRESS BAR
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {account && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)',
          borderTop: '1px solid #E5E0D8',
          boxShadow: '0 -2px 16px rgba(0,0,0,0.06)',
          padding: '14px 24px',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Step label above the bar on mobile */}
            <div className="text-center text-xs font-bold text-[#1A1A2E] mb-2 sm:hidden">
              Step {currentStep}: {['Select Policy', 'File Claim', 'Oracle Verify', 'Auto Payout'][currentStep - 1] || 'Select Policy'}
            </div>
            
            <div className="flex items-center justify-between">
              {[
                { n: 1, label: 'Select Policy', done: currentStep >= 2, active: currentStep === 1 },
                { n: 2, label: 'File Claim',    done: currentStep >= 3, active: currentStep === 2 },
                { n: 3, label: 'Oracle Verify', done: currentStep >= 4, active: currentStep === 3 },
                { n: 4, label: 'Auto Payout',   done: currentStep >= 5, active: currentStep === 4 },
              ].map(({ n, label, done, active }, idx) => (
                <React.Fragment key={n}>
                  <div className="flex flex-col items-center gap-1.5 flex-1" style={{ minWidth: 50 }}>
                    <div 
                      className="claim-progress-circle"
                      style={{
                        width: 40, height: 40, borderRadius: '50%', position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, transition: 'all 0.3s',
                        background: done ? '#1A1A2E' : 'transparent',
                        border: `2px solid ${done ? '#1A1A2E' : active ? '#1A1A2E' : '#D1D5DB'}`,
                        color: done ? '#fff' : active ? '#1A1A2E' : '#9CA3AF',
                      }}
                    >
                      {done ? <Check size={16} /> : n}
                      {active && !done && (
                        <span style={{
                          position: 'absolute', top: -2, right: -2, width: 10, height: 10,
                          borderRadius: '50%', background: '#2563EB',
                        }} />
                      )}
                    </div>
                    <span 
                      className="claim-progress-label"
                      style={{ fontSize: 9, textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: (done || active) ? '#1A1A2E' : '#9CA3AF', lineHeight: 1.2 }}
                    >
                      {label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div 
                      className="claim-progress-line"
                      style={{ height: 2, flex: 1, minWidth: 20, background: currentStep > n ? '#1A1A2E' : '#E5E0D8', transition: 'background 0.3s', marginBottom: 18 }} 
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .claim-progress-circle {
            width: 28px !important;
            height: 28px !important;
            font-size: 11px !important;
          }
          .claim-progress-circle svg {
            width: 12px !important;
            height: 12px !important;
          }
          .claim-progress-label {
            display: none !important;
          }
          .claim-progress-line {
            margin-bottom: 0 !important;
            min-width: 10px !important;
          }
        }
      `}</style>

      {showConfetti && <Confetti />}
    </div>
  );
};

export default Claim;

