import { links } from './links';

export interface Game {
  slug: string;
  name: string;
  tagline: string;
  genre: string;
  players: string;
  session: string;
  status: string;
  rarity: { label: string; color: string };
  flavor: string;
  blurb: string;
  features: string[];
  // Add when they exist; empty sections are hidden.
  steamUrl?: string;
  demoLive?: boolean;
  trailer?: string; // YouTube embed URL
  screenshots: { src: string; alt: string }[];
  ticker?: string;
  theme: { bg: string; text: string; accent: string; 'game-font': string };
}

export const games: Game[] = [
  {
    slug: 'the-fog',
    name: 'The Fog',
    tagline: 'Four friends. One way out. Something else in the fog.',
    genre: 'Co-op horror escape',
    players: '4 (online co-op)',
    session: '[~45 min]',
    status: 'Demo soon',
    rarity: { label: '✦ Legendary', color: '#2ef2ff' },
    flavor: "Don't split up.",
    blurb:
      '[Short pitch: what you do, why it is scary, why it is better with friends.]',
    features: ['[Feature one]', '[Feature two]', '[Feature three]'],
    screenshots: [],
    theme: {
      bg: '#0b1013',
      text: '#dfe7ea',
      accent: '#cfe3e8',
      'game-font': "'Special Elite', monospace",
    },
  },
  {
    slug: 'trust-me-bro',
    name: 'Trust Me Bro',
    tagline: 'Bet it all. Blame your friends.',
    genre: 'Party gambling chaos',
    players: '[2–8] (online)',
    session: '~30 min',
    status: 'Still hammering',
    rarity: { label: '? Unidentified item', color: '#f5ff3d' },
    flavor: 'Not financial advice. Definitely not.',
    blurb:
      '[Short pitch: you and your friends trade, bet and backstab for 30 unhinged minutes.]',
    features: [],
    screenshots: [],
    ticker: 'TMB ▲ 420% · RUG ▼ 99% · HOPIUM ▲ ∞ · BRO ▲ 69% · COPIUM ▼ 12% · ',
    theme: {
      bg: '#14001c',
      text: '#fff3fd',
      accent: '#ff3df2',
      'game-font': "'Bungee', sans-serif",
    },
  },
];

export const cta = (g: Game) =>
  g.steamUrl
    ? { label: g.demoLive ? 'Play the demo' : 'Wishlist on Steam', href: g.steamUrl }
    : { label: 'Join the Discord', href: links.discord };

export const themeStyle = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `--${k}:${v}`)
    .join(';');
