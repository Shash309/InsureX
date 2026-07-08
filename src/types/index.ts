export enum ClaimStatus {
  None     = 0,
  Pending  = 1,
  Approved = 2,
  Rejected = 3,
  Paid     = 4,
}

export enum PolicyStatus {
  Active    = 0,
  Claimed   = 1,
  Expired   = 2,
  Cancelled = 3,
}

/** On-chain Policy struct (values after decoding from contract) */
export interface Policy {
  tokenId:          number;
  policyholder:     string;
  policyType:       string;
  coverageAmount:   string;   // ETH string, converted from wei
  premium:          string;   // ETH string, converted from wei
  startDate:        number;   // unix timestamp
  endDate:          number;   // unix timestamp
  status:           PolicyStatus;
  ipfsMetadataHash: string;
}

export interface Claim {
  policyId:       number;
  currentValue:   number;
  thresholdValue: number;
  isTriggered:    boolean;
  status:         ClaimStatus;
}

export interface AIAnalysisResult {
  summary:      string;
  coverage:     string[];
  exclusions:   string[];
  gotchas:      string[];
  grade:        'A' | 'B' | 'C' | 'D' | 'F';
  grade_reason: string;
}
