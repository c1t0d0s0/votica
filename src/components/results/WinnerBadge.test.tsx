import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WinnerBadge } from './WinnerBadge';
import { RoundResultSummary } from '../../lib/types';
import { LanguageProvider } from '../../contexts/LanguageContext';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import confetti from 'canvas-confetti';

describe('WinnerBadge', () => {
  const originalNavigator = globalThis.navigator;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    const store: Record<string, string> = { votica_lang: 'ja' };
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  const mockWinner = {
    option: { id: 'opt1', text: 'Option A', color: '#ff0000' },
    votesCount: 3,
    percentage: 60,
    rank: 1,
    voters: [],
  };

  const mockSecond = {
    option: { id: 'opt2', text: 'Option B', color: '#00ff00' },
    votesCount: 2,
    percentage: 40,
    rank: 2,
    voters: [],
  };

  const mockSummary: RoundResultSummary = {
    roundNumber: 1,
    totalVoters: 5,
    totalVotes: 5,
    results: [mockWinner, mockSecond],
    topOptions: [mockWinner],
    winner: mockWinner,
    hasTieForFirst: false,
    tiedFirstOptions: [],
  };

  it('renders "暫定1位" in Japanese when poll is still open (isPollClosed=false)', () => {
    const html = renderToString(
      <LanguageProvider>
        <WinnerBadge
          summary={mockSummary}
          isAdmin={false}
          isPollClosed={false}
        />
      </LanguageProvider>
    );

    expect(html).toContain('暫定1位');
    expect(html).not.toContain('第1位 確定');
    expect(html).toContain('Option A');
    expect(confetti).not.toHaveBeenCalled();
  });

  it('renders "第1位 確定" in Japanese when poll is closed (isPollClosed=true)', () => {
    const html = renderToString(
      <LanguageProvider>
        <WinnerBadge
          summary={mockSummary}
          isAdmin={false}
          isPollClosed={true}
        />
      </LanguageProvider>
    );

    expect(html).toContain('第1位 確定');
    expect(html).not.toContain('暫定1位');
    expect(html).toContain('Option A');
  });

  it('renders "Provisional 1st Place" in English when poll is still open', () => {
    localStorage.setItem('votica_lang', 'en');
    const html = renderToString(
      <LanguageProvider>
        <WinnerBadge
          summary={mockSummary}
          isAdmin={false}
          isPollClosed={false}
        />
      </LanguageProvider>
    );

    expect(html).toContain('Provisional 1st Place');
    expect(html).not.toContain('1st Place Winner Confirmed');
    expect(html).toContain('Option A');
  });

  it('renders "1st Place Winner Confirmed" in English when poll is closed', () => {
    localStorage.setItem('votica_lang', 'en');
    const html = renderToString(
      <LanguageProvider>
        <WinnerBadge
          summary={mockSummary}
          isAdmin={false}
          isPollClosed={true}
        />
      </LanguageProvider>
    );

    expect(html).toContain('1st Place Winner Confirmed');
    expect(html).not.toContain('Provisional 1st Place');
    expect(html).toContain('Option A');
  });

  it('renders tie alert when there is a tie for first place', () => {
    const tied1 = {
      option: { id: 'opt1', text: 'Option A' },
      votesCount: 2,
      percentage: 50,
      rank: 1,
    };
    const tied2 = {
      option: { id: 'opt2', text: 'Option B' },
      votesCount: 2,
      percentage: 50,
      rank: 1,
    };

    const tieSummary: RoundResultSummary = {
      roundNumber: 1,
      totalVoters: 4,
      totalVotes: 4,
      results: [tied1, tied2],
      topOptions: [tied1, tied2],
      winner: null,
      hasTieForFirst: true,
      tiedFirstOptions: [tied1, tied2],
    };

    const html = renderToString(
      <LanguageProvider>
        <WinnerBadge
          summary={tieSummary}
          isAdmin={true}
          isPollClosed={false}
        />
      </LanguageProvider>
    );

    expect(html).toContain('同率1位検出');
    expect(html).not.toContain('第1位 確定');
    expect(html).not.toContain('暫定1位');
  });

  it('renders null when there is no winner and no tie', () => {
    const emptySummary: RoundResultSummary = {
      roundNumber: 1,
      totalVoters: 0,
      totalVotes: 0,
      results: [],
      topOptions: [],
      winner: null,
      hasTieForFirst: false,
      tiedFirstOptions: [],
    };

    const html = renderToString(
      <LanguageProvider>
        <WinnerBadge
          summary={emptySummary}
          isAdmin={false}
          isPollClosed={false}
        />
      </LanguageProvider>
    );

    expect(html).toBe('');
  });
});
