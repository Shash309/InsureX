import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePolicy } from '../hooks/usePolicy';
import { Policy, PolicyStatus } from '../types';
import { API_URL } from '../config/env';

interface DashboardProps {
  account: string | null;
  provider: any;
  signer: any;
  connectWallet: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const policyStatusMeta = (status: PolicyStatus) => {
  switch (status) {
    case PolicyStatus.Active:    return { label: 'Active',    cls: 'pill pill-blue'  };
    case PolicyStatus.Claimed:   return { label: 'Claimed',   cls: 'pill pill-green' };
    case PolicyStatus.Expired:   return { label: 'Expired',   cls: 'pill pill-gray'  };
    case PolicyStatus.Cancelled: return { label: 'Cancelled', cls: 'pill pill-red'   };
    default:                     return { label: 'Unknown',   cls: 'pill pill-gray'  };
  }
};

const policyTypeIcon: Record<string, string> = {
  travel: '✈️',
  health: '🏥',
  crop:   '🌾',
  auto:   '🚗',
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

const Spinner = ({ size = 'sm' }: { size?: 'sm' | 'md' }) => (
  <svg
    className={`animate-spin ${size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'}`}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { type: 'success' | 'error'; msg: string }

const ToastBanner: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => (
  <div
    className={`flex items-start gap-3 p-4 rounded-xl text-sm border ${
      toast.type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-red-50 border-red-200 text-red-800'
    }`}
  >
    <span className="text-lg leading-none mt-0.5">{toast.type === 'success' ? '✓' : '⚠'}</span>
    <p className="flex-1 leading-relaxed">{toast.msg}</p>
    <button onClick={onClose} className="text-current opacity-50 hover:opacity-100 text-lg leading-none">&times;</button>
  </div>
);

// ─── Mint Form ────────────────────────────────────────────────────────────────

interface MintFormProps {
  account: string;
  mintPolicy: (
    policyType: string,
    coverage: string,
    duration: number,
    ipfsHash: string,
    premium: string,
  ) => Promise<number>;
  loading: boolean;
  onMinted: (tokenId: number) => void;
  onError: (msg: string) => void;
}

const MintForm: React.FC<MintFormProps> = ({ account, mintPolicy, loading, onMinted, onError }) => {
  const [policyType, setPolicyType]  = useState('travel');
  const [coverage, setCoverage]      = useState('1.0');
  const [duration, setDuration]      = useState(30);
  const [ipfsHash, setIpfsHash]      = useState('');
  const [premium, setPremium]        = useState('0.1');

  // Dynamic pricing states
  const [destination, setDestination] = useState('France');
  const [airline, setAirline]         = useState('');
  const [location, setLocation]       = useState('Rajasthan');
  const [cropType, setCropType]       = useState('wheat');
  const [season, setSeason]           = useState('rabi');
  const [age, setAge]                 = useState(30);
  const [hasPreExisting, setHasPreExisting] = useState(false);
  const [smoker, setSmoker]           = useState(false);
  const [breakdown, setBreakdown]     = useState<any | null>(null);

  const roundEth = (val: number) => Math.round(val * 10000) / 10000;

  useEffect(() => {
    const fetchPrice = async () => {
      const covNum = parseFloat(coverage);
      if (isNaN(covNum) || covNum <= 0 || isNaN(duration) || duration <= 0) {
        return;
      }
      try {
        let url = "";
        let body = {};
        if (policyType === 'travel') {
          url = `${API_URL}/pricing/travel`;
          body = {
            coverage_eth: covNum,
            duration_days: duration,
            destination: destination || "France",
            airline: airline || ""
          };
        } else if (policyType === 'crop') {
          url = `${API_URL}/pricing/crop`;
          body = {
            coverage_eth: covNum,
            duration_days: duration,
            location: location || "Rajasthan",
            crop_type: cropType || "wheat",
            season: season || "rabi"
          };
        } else if (policyType === 'health') {
          url = `${API_URL}/pricing/health`;
          body = {
            coverage_eth: covNum,
            duration_days: duration,
            age: Number(age) || 30,
            has_pre_existing: hasPreExisting,
            smoker: smoker
          };
        } else {
          // Auto / Fallback
          const basePrem = roundEth(covNum * 0.02);
          const totalPrem = Math.max(0.01, basePrem);
          setPremium(String(totalPrem));
          setBreakdown({
            base_premium: basePrem,
            adjustments: [],
            total: totalPrem
          });
          return;
        }

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          const data = await res.json();
          setPremium(String(data.premium_eth));
          
          const adjustments: { name: string; amount: number }[] = [];
          if (policyType === 'travel') {
            adjustments.push({ name: "Destination Risk", amount: data.breakdown.destination_adjustment });
            adjustments.push({ name: "Duration Adjustment", amount: data.breakdown.duration_adjustment });
          } else if (policyType === 'crop') {
            adjustments.push({ name: "Location Risk", amount: data.breakdown.location_adjustment });
            adjustments.push({ name: "Crop Risk Adjustment", amount: data.breakdown.crop_adjustment });
            adjustments.push({ name: "Season Adjustment", amount: data.breakdown.season_adjustment });
          } else if (policyType === 'health') {
            adjustments.push({ name: "Age Surcharge", amount: data.breakdown.age_adjustment });
            adjustments.push({ name: "Pre-existing Conditions", amount: data.breakdown.pre_existing_adjustment });
            adjustments.push({ name: "Smoker Surcharge", amount: data.breakdown.smoker_adjustment });
          }

          setBreakdown({
            base_premium: data.breakdown.base_premium,
            adjustments,
            total: data.premium_eth
          });
        }
      } catch (err) {
        console.error("Error fetching price", err);
      }
    };

    const timer = setTimeout(fetchPrice, 300);
    return () => clearTimeout(timer);
  }, [
    policyType, coverage, duration, destination, airline,
    location, cropType, season, age, hasPreExisting, smoker
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = await mintPolicy(policyType, coverage, duration, ipfsHash || `ipfs://placeholder-${Date.now()}`, premium);
      onMinted(id);
      // Reset
      setCoverage('1.0');
      setDuration(30);
      setIpfsHash('');
    } catch (err: any) {
      onError(err.reason || err.shortMessage || err.message || 'Transaction failed');
    }
  };

  const inputCls = "w-full border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-sm text-[#1A1A2E] bg-white focus:outline-none focus:border-[#2563EB] transition-colors";
  const labelCls = "block text-[10px] uppercase font-bold text-[#6B7280] tracking-wider mb-1.5";

  return (
    <div className="card p-6 md:p-8">
      <div className="flex items-start gap-4 mb-7">
        <div className="w-11 h-11 rounded-xl bg-[#F0EDE6] flex items-center justify-center text-xl shrink-0">🛡️</div>
        <div>
          <h2 className="serif text-2xl font-semibold" style={{ color: '#1A1A2E' }}>
            Mint New Policy NFT
          </h2>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Lock your insurance terms on-chain as an immutable ERC-721 token.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Policy Type */}
        <div>
          <label className={labelCls}>Policy Type</label>
          <select
            value={policyType}
            onChange={e => setPolicyType(e.target.value)}
            className={inputCls}
            required
          >
            <option value="travel">✈️  Travel</option>
            <option value="health">🏥  Health</option>
            <option value="crop">🌾  Crop</option>
            <option value="auto">🚗  Auto</option>
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className={labelCls}>Duration (days)</label>
          <input
            type="number"
            min={1}
            max={3650}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className={inputCls}
            placeholder="e.g. 30"
            required
          />
        </div>

        {/* Coverage Amount */}
        <div>
          <label className={labelCls}>Coverage Amount (ETH)</label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={coverage}
            onChange={e => setCoverage(e.target.value)}
            className={inputCls}
            placeholder="e.g. 1.0"
            required
          />
        </div>

        {/* Conditional Extra Fields */}
        {policyType === 'travel' && (
          <>
            <div>
              <label className={labelCls}>Destination</label>
              <input
                type="text"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className={inputCls}
                placeholder="e.g. France, Pakistan, Egypt"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Airline (Optional)</label>
              <input
                type="text"
                value={airline}
                onChange={e => setAirline(e.target.value)}
                className={inputCls}
                placeholder="e.g. Air India"
              />
            </div>
          </>
        )}

        {policyType === 'crop' && (
          <>
            <div>
              <label className={labelCls}>Location/Region</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className={inputCls}
                placeholder="e.g. Rajasthan, Assam"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Crop Type</label>
              <select
                value={cropType}
                onChange={e => setCropType(e.target.value)}
                className={inputCls}
                required
              >
                <option value="wheat">🌾 Wheat</option>
                <option value="rice">🍚 Rice</option>
                <option value="cotton">🌱 Cotton</option>
                <option value="sugarcane">🎋 Sugarcane</option>
                <option value="vegetables">🥦 Vegetables</option>
                <option value="fruits">🍎 Fruits</option>
                <option value="pulses">🫘 Pulses</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Season</label>
              <select
                value={season}
                onChange={e => setSeason(e.target.value)}
                className={inputCls}
                required
              >
                <option value="kharif">Kharif (Monsoon)</option>
                <option value="rabi">Rabi (Winter)</option>
                <option value="zaid">Zaid (Summer)</option>
              </select>
            </div>
          </>
        )}

        {policyType === 'health' && (
          <>
            <div>
              <label className={labelCls}>Age</label>
              <input
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={e => setAge(Number(e.target.value))}
                className={inputCls}
                required
              />
            </div>
            <div className="flex gap-6 items-center mt-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#1A1A2E] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasPreExisting}
                  onChange={e => setHasPreExisting(e.target.checked)}
                  className="rounded border-[#E5E0D8] text-[#2563EB] focus:ring-[#2563EB]"
                />
                Pre-existing conditions
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#1A1A2E] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={smoker}
                  onChange={e => setSmoker(e.target.checked)}
                  className="rounded border-[#E5E0D8] text-[#2563EB] focus:ring-[#2563EB]"
                />
                Smoker
              </label>
            </div>
          </>
        )}

        {/* Premium (Read-Only) */}
        <div>
          <label className={labelCls}>Calculated Premium (ETH)</label>
          <input
            type="text"
            value={premium + " ETH"}
            readOnly
            className={`${inputCls} bg-gray-50 cursor-not-allowed font-bold text-emerald-700`}
          />
        </div>

        {/* IPFS Hash — full width */}
        <div className="col-span-1 md:col-span-2">
          <label className={labelCls}>IPFS Metadata Hash</label>
          <input
            type="text"
            value={ipfsHash}
            onChange={e => setIpfsHash(e.target.value)}
            className={inputCls}
            placeholder="ipfs://your-hash (leave blank to auto-generate)"
          />
          <p className="text-[10px] text-[#6B7280] mt-1">
            Full policy document uploaded to IPFS. Leave blank to use a placeholder.
          </p>
        </div>

        {/* Premium Breakdown Card — full width */}
        {breakdown && (
          <div className="col-span-1 md:col-span-2 p-5 rounded-xl border border-[#E5E0D8] bg-[#F9F8F6] text-xs premium-breakdown">
            <h4 className="font-bold text-[#1A1A2E] uppercase tracking-wider text-[10px] mb-3">Premium Breakdown</h4>
            <div className="flex flex-col gap-2 font-medium text-[#6B7280]">
              <div className="flex justify-between premium-row">
                <span>Base Premium:</span>
                <span className="text-[#1A1A2E] font-semibold">{breakdown.base_premium} ETH</span>
              </div>
              {breakdown.adjustments && breakdown.adjustments.map((adj: any) => {
                if (adj.amount === 0) return null;
                const sign = adj.amount > 0 ? "+" : "";
                return (
                  <div key={adj.name} className="flex justify-between premium-row">
                    <span>{adj.name}:</span>
                    <span className={adj.amount > 0 ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"}>
                      {sign}{adj.amount} ETH
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-[#E5E0D8] pt-2 mt-1 flex justify-between text-sm font-bold premium-row">
                <span className="text-[#1A1A2E]">Total Premium:</span>
                <span className="text-emerald-700">{breakdown.total} ETH</span>
              </div>
            </div>
          </div>
        )}

        {/* Wallet preview */}
        <div className="col-span-1 md:col-span-2 bg-[#F8F6F1] border border-[#E5E0D8] rounded-xl p-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-[11px] font-mono text-[#1A1A2E] hidden md:inline">{account}</span>
          <span className="text-[11px] font-mono text-[#1A1A2E] inline md:hidden wallet-address">{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : ''}</span>
          <span className="ml-auto text-[10px] text-[#6B7280]">policyholder</span>
        </div>

        {/* Submit */}
        <div className="col-span-1 md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="btn w-full justify-center text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#1A1A2E', color: '#FFFFFF', opacity: 1 }}
          >
            {loading ? (
              <><Spinner /> Confirming transaction…</>
            ) : (
              'Mint Policy NFT'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Policy Card ──────────────────────────────────────────────────────────────

const PolicyCard: React.FC<{ policy: Policy }> = ({ policy }) => {
  const { label, cls } = policyStatusMeta(policy.status);
  const icon = policyTypeIcon[policy.policyType.toLowerCase()] ?? '📄';
  const isActive = policy.status === PolicyStatus.Active;

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0EDE6] flex items-center justify-center text-lg">
            {icon}
          </div>
          <div>
            <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider">Token ID</span>
            <span className="mono text-sm font-semibold" style={{ color: '#1A1A2E' }}>
              #{String(policy.tokenId).padStart(4, '0')}
            </span>
          </div>
        </div>
        <span className={cls}>{label}</span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <div>
          <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider mb-0.5">Type</span>
          <span className="font-medium capitalize" style={{ color: '#1A1A2E' }}>{policy.policyType}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider mb-0.5">Coverage</span>
          <span className="mono font-bold text-emerald-700">{policy.coverageAmount} ETH</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider mb-0.5">Start</span>
          <span style={{ color: '#1A1A2E' }}>{fmtDate(policy.startDate)}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider mb-0.5">Expires</span>
          <span style={{ color: '#1A1A2E' }}>{fmtDate(policy.endDate)}</span>
        </div>
      </div>

      {/* IPFS */}
      {policy.ipfsMetadataHash && (
        <div className="truncate">
          <span className="block text-[9px] uppercase font-bold text-[#6B7280] tracking-wider mb-0.5">IPFS</span>
          <span className="mono text-[10px] text-[#2563EB] truncate block">{policy.ipfsMetadataHash}</span>
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-[#E5E0D8]">
        {isActive ? (
          <Link
            to={`/claim?policyId=${policy.tokenId}`}
            className="btn w-full justify-center text-xs"
            style={{ background: 'transparent', color: '#1A1A2E', border: '2px solid #1A1A2E', opacity: 1 }}
          >
            File a Claim →
          </Link>
        ) : (
          <span className="text-xs text-[#6B7280] flex items-center gap-1.5">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            No actions available
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────

interface PoolStats {
  pool_balance_eth: number;
  total_premiums_collected: number;
  total_claims_paid: number;
  active_policies: number;
  coverage_exposure_eth: number;
  pool_open: boolean;
  pool_ratio_percent: number;
  pool_health: string;
  health_color: string;
  solvency_message: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ account, provider, signer, connectWallet }) => {
  const { mintPolicy, getPolicies, loading: hookLoading, error: hookError } = usePolicy(provider, signer, account);
  const [policies, setPolicies]     = useState<Policy[]>([]);
  const [fetching, setFetching]     = useState(false);
  const [toast, setToast]           = useState<Toast | null>(null);
  const [poolStats, setPoolStats]   = useState<PoolStats | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const location = useLocation();

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 6000);
  };

  const fetchPolicies = async () => {
    if (!account) return;
    try {
      setLoading(true);
      setError(null);
      setFetching(true);
      const list = await getPolicies();
      setPolicies(list);
    } catch (err: any) {
      console.error("Dashboard error:", err);
      setError("Could not load policies. Make sure your wallet is connected and the blockchain is running.");
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  const fetchPoolStats = async () => {
    try {
      const res = await fetch(
        `${API_URL}/pool/stats?t=${Date.now()}`
      );
      const data = await res.json();
      console.log("Pool stats fetched:", data);
      setPoolStats(data);
    } catch (err) {
      console.error("Pool stats error:", err);
    }
  };

  useEffect(() => {
    if (account) {
      fetchPolicies();
      fetchPoolStats();
    }
  }, [location.pathname, account]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchPolicies();
        fetchPoolStats();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    fetchPoolStats();
    const interval = setInterval(fetchPoolStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMinted = async (tokenId: number) => {
    showToast({ type: 'success', msg: `Policy NFT minted! Token ID: #${String(tokenId).padStart(4, '0')}` });
    await fetchPolicies();
    await fetchPoolStats();
  };

  const handleError = (msg: string) => {
    showToast({ type: 'error', msg });
  };

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!account) {
    return (
      <div className="bg-[#F8F6F1] dot-grid min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-sm w-full p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F0EDE6] flex items-center justify-center text-3xl mb-6">🔒</div>
          <h2 className="serif text-2xl mb-2" style={{ color: '#1A1A2E' }}>Connect your wallet</h2>
          <p className="text-sm text-[#6B7280] mb-7 leading-relaxed">
            Connect your wallet to view policies and mint new coverage on-chain.
          </p>
          <button
            onClick={connectWallet}
            className="btn w-full justify-center"
            style={{ background: '#1A1A2E', color: '#FFFFFF', opacity: 1 }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#F8F6F1] dot-grid min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-md w-full p-10 text-center" style={{ 
          textAlign: "center", 
          padding: "80px 20px",
          color: "#6B7280" 
        }}>
          <h2 style={{ color: "#1A1A2E", marginBottom: 12, fontFamily: "'Playfair Display', serif", fontSize: 24 }}>
            Connection Error
          </h2>
          <p>{error}</p>
          <button 
            onClick={fetchPolicies}
            style={{
              marginTop: 24,
              padding: "10px 24px",
              background: "#1A1A2E",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#F8F6F1] dot-grid min-h-screen flex items-center justify-center px-6">
        <div className="card max-w-sm w-full p-10 flex flex-col items-center text-center">
          <Spinner size="md" />
          <p style={{ marginTop: 16 }}>Loading your policies...</p>
        </div>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#F8F6F1] dot-grid min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-10">



        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="pill pill-ink mb-3">Dashboard</span>
            <h1 className="serif text-4xl md:text-5xl" style={{ color: '#1A1A2E', opacity: 1 }}>
              Protection Portfolio
            </h1>
            <p className="text-[#6B7280] mt-2 text-sm">
              Mint new policies and track active coverage on-chain.
            </p>
          </div>
          <button
            onClick={() => { fetchPolicies(); fetchPoolStats(); }}
            disabled={fetching}
            className="btn btn-ghost self-start md:self-auto"
          >
            {fetching ? <Spinner /> : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
            )}
            {fetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <ToastBanner toast={toast} onClose={() => setToast(null)} />
        )}

        {/* Hook-level error */}
        {hookError && !toast && (
          <div className="flex gap-3 items-start bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            <span className="mt-0.5">⚠</span>
            <div><strong>Contract error:</strong> {hookError}</div>
          </div>
        )}

        {/* ── Section 1: Mint Form ── */}
        <MintForm
          account={account}
          mintPolicy={mintPolicy}
          loading={hookLoading}
          onMinted={handleMinted}
          onError={handleError}
        />

        {/* ── Section 1.5: Treasury Dashboard ── */}
        {poolStats && (
          <div key={JSON.stringify(poolStats)} className="card p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 mb-7">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-[#F0EDE6] flex items-center justify-center text-xl shrink-0">🏛️</div>
                <div>
                  <h2 className="serif text-2xl font-semibold" style={{ color: '#1A1A2E' }}>
                    Treasury Dashboard
                  </h2>
                  <p className="text-sm text-[#6B7280] mt-0.5">
                    Real-time status of the InsureX underwriting pool and reserves.
                  </p>
                </div>
              </div>
              <button
                onClick={fetchPoolStats}
                className="btn btn-ghost shrink-0 text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                Refresh
              </button>
            </div>

            {/* Grid of 6 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {/* Card 1 — Pool Balance */}
              <div className="card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-2xl mb-2">💰</span>
                <div>
                  <span className="mono text-lg font-semibold block text-[#1A1A2E]">
                    {poolStats.pool_balance_eth.toFixed(4)} ETH
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider block mt-1">
                    Available for Claims
                  </span>
                </div>
              </div>

              {/* Card 2 — Total Premiums Collected */}
              <div className="card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-2xl mb-2">📈</span>
                <div>
                  <span className="mono text-lg font-semibold block text-[#1A1A2E]">
                    {poolStats.total_premiums_collected.toFixed(4)} ETH
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider block mt-1">
                    Revenue Generated
                  </span>
                </div>
              </div>

              {/* Card 3 — Total Claims Paid */}
              <div className="card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-2xl mb-2">📤</span>
                <div>
                  <span className="mono text-lg font-semibold block text-[#1A1A2E]">
                    {poolStats.total_claims_paid.toFixed(4)} ETH
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider block mt-1">
                    Paid to Policyholders
                  </span>
                </div>
              </div>

              {/* Card 4 — Active Policies */}
              <div className="card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-2xl mb-2">📋</span>
                <div>
                  <span className="mono text-lg font-semibold block text-[#1A1A2E]">
                    {poolStats.active_policies}
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider block mt-1">
                    Policies in Force
                  </span>
                </div>
              </div>

              {/* Card 5 — Coverage Exposure */}
              <div className="card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-2xl mb-2">🛡️</span>
                <div>
                  <span className="mono text-lg font-semibold block text-[#1A1A2E]">
                    {poolStats.coverage_exposure_eth.toFixed(4)} ETH
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider block mt-1">
                    Maximum Liability
                  </span>
                </div>
              </div>

              {/* Card 6 — Pool Health */}
              <div className="card p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                <span className="text-2xl mb-2">❤️</span>
                <div>
                  <span className={`text-lg font-semibold block ${
                    poolStats.health_color === 'green' ? 'text-emerald-600' :
                    poolStats.health_color === 'amber' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {poolStats.pool_health}
                  </span>
                  <span className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider block mt-1">
                    Solvency Status
                  </span>
                </div>
              </div>
            </div>

            {/* Collateralization Ratio progress bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-2">
                <span>Collateralization Ratio</span>
                <span className={
                  poolStats.pool_ratio_percent >= 50 ? 'text-emerald-600 font-mono' :
                  poolStats.pool_ratio_percent >= 20 ? 'text-amber-600 font-mono' : 'text-red-600 font-mono'
                }>
                  {poolStats.pool_ratio_percent}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-[#E5E0D8]">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    poolStats.pool_ratio_percent >= 50 ? 'bg-emerald-500' :
                    poolStats.pool_ratio_percent >= 20 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, poolStats.pool_ratio_percent)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#6B7280] mt-2 italic">
                {poolStats.solvency_message} (Required Min: 20%)
              </p>
            </div>

            {/* Pool Status indicator */}
            <div className="border-t border-[#E5E0D8] pt-4 mt-2 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${poolStats.pool_open ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-xs font-semibold text-[#1A1A2E]">
                Pool Status: {poolStats.pool_open ? (
                  <span className="text-emerald-600 font-bold uppercase">OPEN for new policies</span>
                ) : (
                  <span className="text-red-600 font-bold uppercase">PAUSED - undercollateralized</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* ── Section 2: My Policies ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="serif text-2xl" style={{ color: '#1A1A2E', opacity: 1 }}>
              My Policies
            </h2>
            <span className="mono text-sm text-[#6B7280]">{policies.length} token{policies.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Stats strip */}
          {policies.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total',     value: policies.length },
                { label: 'Active',    value: policies.filter(p => p.status === PolicyStatus.Active).length },
                { label: 'Claimed',   value: policies.filter(p => p.status === PolicyStatus.Claimed).length },
                { label: 'Expired',   value: policies.filter(p => p.status === PolicyStatus.Expired).length },
              ].map(({ label, value }) => (
                <div key={label} className="card p-4 text-center">
                  <span className="mono text-2xl font-semibold block" style={{ color: '#1A1A2E' }}>{value}</span>
                  <span className="text-xs text-[#6B7280] mt-0.5 block">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Loading skeleton */}
          {fetching ? (
            <div className="flex items-center justify-center py-20 gap-3 text-[#6B7280]">
              <Spinner size="md" />
              <span className="text-sm">Loading policies from smart contract…</span>
            </div>
          ) : policies.length === 0 ? (
            /* Empty state */
            <div className="card p-12 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F0EDE6] flex items-center justify-center text-2xl mb-5">📋</div>
              <h3 className="serif text-xl mb-2" style={{ color: '#1A1A2E' }}>No policies yet</h3>
              <p className="text-sm text-[#6B7280] max-w-xs leading-relaxed">
                Use the form above to mint your first parametric insurance policy NFT.
              </p>
            </div>
          ) : (
            /* Policy grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {policies.map(policy => (
                <PolicyCard key={policy.tokenId} policy={policy} />
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .premium-row {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 4px;
        }
        
        @media (max-width: 768px) {
          /* General mobile rules */
          .card, .p-5, .p-6, .p-8, .p-10, .p-12 {
            padding: 16px !important;
          }
          
          .px-6, .pt-28, .pb-24 {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          body, p, span, label, input, select, textarea, button, a, .text-sm, .text-xs, .text-mono {
            font-size: calc(100% - 2px) !important;
          }
          .serif, h1, h2, h3, h4 {
            font-size: calc(100% - 2px) !important;
          }
          .text-2xl, .serif.text-2xl {
            font-size: 1.25rem !important;
          }
          .text-4xl, .serif.text-4xl, .text-5xl, .serif.text-5xl {
            font-size: 2rem !important;
          }

          html, body, #root, .dot-grid {
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }

          /* Fix 1 — Premium Breakdown card text cutoff */
          .premium-breakdown {
            font-size: 12px !important;
          }
          .premium-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 2px !important;
          }
          .premium-row span {
            width: 100% !important;
            text-align: left !important;
            white-space: normal !important;
            word-break: break-all !important;
          }

          /* Fix 3 — Wallet address display */
          .wallet-address {
            font-size: 11px !important;
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          /* Fix 6 — Mint Policy NFT button */
          form button[type="submit"] {
            width: 100% !important;
            padding: 16px !important;
          }

          /* Fix 2 — Dashboard mint form height & padding-bottom */
          .card {
            max-height: none !important;
            height: auto !important;
          }
          .pb-24 {
            padding-bottom: 100px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
