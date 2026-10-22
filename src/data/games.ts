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
  theme: Record<string, string>; // bg, text, accent, game-font, haze-1..4, haze-strength
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
      'haze-1': '#9fb3ba',
      'haze-2': '#cfe3e8',
      'haze-3': '#6f8a94',
      'haze-4': '#dfe7ea',
      'haze-strength': '0.8',
      // Thick, slow fog that hangs around. The cursor is a flashlight that pushes it aside.
      'haze-flashlight': '1',
      'haze-mouse-dye': '0',
      'haze-mouse-force': '2500',
      'haze-fade': '0.06',
      'haze-curl': '4',
      'haze-ambient-every': '500',
      'haze-ambient-dye': '0.18',
      'haze-ambient-force': '60',
      'haze-ambient-radius': '3',
      'haze-seed': '30',
      'haze-spore-count': '0.35',
      'haze-spore-gravity': '0.06',
      'haze-spore-size': '0.8',
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
      'haze-1': '#ff3df2',
      'haze-2': '#f5ff3d',
      'haze-3': '#ffd23d',
      'haze-4': '#b6ff2e',
      'haze-strength': '1.1',
      // Frantic market chaos: fast twitchy bursts and falling gold flecks.
      'haze-curl': '45',
      'haze-fade': '0.9',
      'haze-mouse-dye': '0.15',
      'haze-mouse-force': '5000',
      'haze-ambient-every': '450',
      'haze-ambient-dye': '0.45',
      'haze-ambient-force': '900',
      'haze-ambient-radius': '0.25',
      'haze-seed': '8',
      'haze-spore-count': '1.3',
      'haze-spore-gravity': '0.7',
      'haze-spore-size': '1.3',
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
