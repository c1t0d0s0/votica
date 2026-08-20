export interface PollOption {
  id: string;
  text: string;
  description?: string;
  color?: string;
}

export interface PollRound {
  roundNumber: number;
  title: string;
  description?: string;
  startDate: string; // ISO 8601 string
  endDate: string;   // ISO 8601 string
  maxChoices: number; // 1 to N
  options: PollOption[]; // Up to 20 options
  status: 'scheduled' | 'open' | 'closed';
  runoffSourceRound?: number;
  candidateSource?: 'manual' | 'tie_breaker' | 'top_k';
  createdAt?: string;
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  creatorUid: string;
  creatorDisplayName: string;
  creatorEmail?: string;
  creatorPhotoURL?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'closed' | 'archived';
  isPublicResult: boolean;
  currentRound: number;
  totalRounds: number;
}

export interface Vote {
  id: string; // doc ID = userId
  userId: string;
  userDisplayName?: string;
  userPhotoURL?: string;
  selectedOptionIds: string[];
  votedAt: string;
}

export interface OptionResult {
  option: PollOption;
  votesCount: number;
  percentage: number;
  rank: number;
  isWinner?: boolean;
  isTied?: boolean;
}

export interface RoundResultSummary {
  roundNumber: number;
  totalVotes: number;
  totalVoters: number;
  results: OptionResult[];
  topOptions: OptionResult[];
  hasTieForFirst: boolean;
  tiedFirstOptions: OptionResult[];
  winner: OptionResult | null;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
