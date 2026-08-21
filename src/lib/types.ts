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

export type ScheduleChoice = 'circle' | 'triangle' | 'cross' | 'question';

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
  requireAuth: boolean; // true = Google login required (default), false = login not required (self-declared name)
  showVoterNames: boolean; // true = show voter breakdown per option, false = hide who voted for what (default: false)
  currentRound: number;
  totalRounds: number;
  pollType?: 'poll' | 'schedule'; // 'poll' (standard voting) | 'schedule' (chouseisan-style schedule adjustment)
}

export interface Vote {
  id: string; // doc ID = userId
  userId: string;
  userDisplayName?: string;
  userPhotoURL?: string;
  selectedOptionIds: string[];
  scheduleResponses?: Record<string, ScheduleChoice>; // optionId -> 'circle' | 'triangle' | 'cross' | 'question'
  comment?: string; // Optional short comment from voter
  votedAt: string;
}

export interface ScheduleOptionSummary {
  option: PollOption;
  circleCount: number;
  triangleCount: number;
  crossCount: number;
  questionCount: number;
  score: number; // circle * 2 + triangle * 1
  rank: number;
  isBest?: boolean;
}

export interface ScheduleVoterRow {
  userId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  responses: Record<string, ScheduleChoice>;
  comment?: string;
  votedAt: string;
}

export interface ScheduleResultSummary {
  options: ScheduleOptionSummary[];
  voters: ScheduleVoterRow[];
  totalVoters: number;
  bestOptions: ScheduleOptionSummary[];
}

export interface OptionResult {
  option: PollOption;
  votesCount: number;
  percentage: number;
  rank: number;
  isWinner?: boolean;
  isTied?: boolean;
  voters?: {
    userId: string;
    userDisplayName: string;
    userPhotoURL?: string;
  }[];
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
