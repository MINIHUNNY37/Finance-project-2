export interface EntitySubItem {
  id: string;
  title: string;
  description: string;
  date?: string;   // optional date/time label e.g. "Q4 2024" or "Jan 2025"
}

export interface EntityStatistic {
  id: string;
  name: string;   // template label e.g. "Revenue", "P/E Ratio" — this is what gets saved
  value: string;  // current figure e.g. "$394B"
  asOf?: string;  // optional timestamp e.g. "FY2024" or "2024-12-31"
}

export interface EntityCatalyst {
  id: string;
  event: string;          // e.g. "Q3 Earnings Report"
  expectedDate?: string;  // ISO date e.g. "2025-10-28"
  status: 'pending' | 'hit' | 'miss';
  outcome?: string;       // what actually happened
  createdAt: string;
}

export interface EntityLink {
  id: string;
  url: string;
  title: string;
  note?: string;
  addedAt: string;
}

export interface Entity {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  description: string;
  entityKind?: 'custom' | 'stock'; // 'stock' = pre-built from library, opens flashcard
  subItems: EntitySubItem[];
  statistics: EntityStatistic[];
  color: string;
  country: string;
  position: { x: number; y: number };
  locked?: boolean;
  fixedSize?: boolean;
  hidden?: boolean;
  folderId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Ticker / live price fields
  ticker?: string;
  livePrice?: number;
  priceChange?: number;   // absolute change
  priceChangePct?: number; // % change
  marketCap?: string;
  peRatio?: string;
  week52Low?: number;
  week52High?: number;
  lastPriceFetch?: string; // ISO timestamp
  // Investment thesis fields
  targetPrice?: number;
  entryPrice?: number;
  // Thesis log
  thesis?: string;        // "why I own this"
  exitCriteria?: string;  // "what would change my mind"
  conviction?: number;    // 1–5
  // Catalyst checklist
  catalysts?: EntityCatalyst[];
  // Sector / theme
  sector?: string;
  tags?: string[];
  // Research hub
  links?: EntityLink[];
}

export type ArrowStyle = 'normal' | 'animated';

export interface Relationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  label: string;
  description: string; // shown as a note box on the connection
  color: string;
  arrowStyle: ArrowStyle;
  createdBy: string;
  createdAt: string;
  drawnPath?: { x: number; y: number }[]; // freehand path from draw mode
  hidden?: boolean;
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  entityIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface ConnectionFolder {
  id: string;
  name: string;
  color: string;
  relationshipIds: string[];
  createdAt: string;
}

export interface GeoEventFolder {
  id: string;
  name: string;
  color: string;
  geoEventIds: string[];
  createdAt: string;
}

export interface ScenarioMap {
  id: string;
  name: string;
  description: string;
  entities: Entity[];
  relationships: Relationship[];
  folders: Folder[];
  geoEvents: GeoEvent[];
  connectionFolders?: ConnectionFolder[];
  geoEventFolders?: GeoEventFolder[];
  ownerId: string;
  sharedWith: string[];
  shareToken?: string;
  mapType?: 'world' | 'plain';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export const ENTITY_ICONS = [
  { value: '🏢', label: 'Company' },
  { value: '🏭', label: 'Factory' },
  { value: '🏦', label: 'Bank' },
  { value: '🛢️', label: 'Oil' },
  { value: '⚡', label: 'Energy' },
  { value: '💊', label: 'Pharma' },
  { value: '🚗', label: 'Auto' },
  { value: '✈️', label: 'Aviation' },
  { value: '🚢', label: 'Shipping' },
  { value: '💻', label: 'Tech' },
  { value: '📱', label: 'Mobile' },
  { value: '🌾', label: 'Agriculture' },
  { value: '⛏️', label: 'Mining' },
  { value: '🏗️', label: 'Construction' },
  { value: '🛒', label: 'Retail' },
  { value: '📺', label: 'Media' },
  { value: '🔬', label: 'Research' },
  { value: '🏥', label: 'Healthcare' },
  { value: '🌐', label: 'Global' },
  { value: '💰', label: 'Finance' },
  { value: '📦', label: 'Logistics' },
  { value: '🔋', label: 'Battery' },
  { value: '🌱', label: 'Green' },
  { value: '🏨', label: 'Hospitality' },
];

export const ENTITY_COLORS = [
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#6366F1',
];

export const RELATIONSHIP_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
];

// ── Geopolitical Events ──────────────────────────────────────────────────────

export type GeoEventType =
  | 'war' | 'election' | 'sanctions' | 'central_bank' | 'regime_change'
  | 'natural_disaster' | 'pandemic' | 'treaty' | 'crisis' | 'referendum'
  | 'energy_crisis' | 'currency_crisis' | 'trade_war' | 'diplomatic';

export const GEO_EVENT_TYPES: { value: GeoEventType; label: string; emoji: string; color: string }[] = [
  { value: 'war',             label: 'War / Armed Conflict',     emoji: '⚔️',  color: '#ef4444' },
  { value: 'election',        label: 'Election',                 emoji: '🗳️',  color: '#3b82f6' },
  { value: 'sanctions',       label: 'Sanctions',                emoji: '🚫',  color: '#f97316' },
  { value: 'central_bank',    label: 'Central Bank Decision',    emoji: '🏦',  color: '#8b5cf6' },
  { value: 'regime_change',   label: 'Regime Change',            emoji: '🔄',  color: '#eab308' },
  { value: 'natural_disaster',label: 'Natural Disaster',         emoji: '🌊',  color: '#14b8a6' },
  { value: 'pandemic',        label: 'Pandemic / Health Crisis', emoji: '🦠',  color: '#22c55e' },
  { value: 'treaty',          label: 'Treaty / Alliance',        emoji: '🤝',  color: '#06b6d4' },
  { value: 'crisis',          label: 'Political Crisis / Coup',  emoji: '💥',  color: '#dc2626' },
  { value: 'referendum',      label: 'Referendum / Vote',        emoji: '📊',  color: '#60a5fa' },
  { value: 'energy_crisis',   label: 'Energy Crisis',            emoji: '⚡',  color: '#f59e0b' },
  { value: 'currency_crisis', label: 'Currency Crisis',          emoji: '💱',  color: '#ec4899' },
  { value: 'trade_war',       label: 'Trade War / Tariffs',      emoji: '📦',  color: '#d97706' },
  { value: 'diplomatic',      label: 'Diplomatic Event',         emoji: '🌐',  color: '#38bdf8' },
];

export interface GeoEvent {
  id: string;
  name: string;
  type: GeoEventType;
  startDate: string;
  endDate?: string;
  details: string;
  position: { x: number; y: number };
  size?: number;      // 0.3 – 4.0 multiplier, default 1
  fixedSize?: boolean; // true (default) = constant screen size regardless of zoom
  hidden?: boolean;
  folderId?: string;
  createdAt: string;
}

// ── Presentation Mode ────────────────────────────────────────────────────────

export type PresentationTransition = 'smooth' | 'fade' | 'slide' | 'zoom-in' | 'zoom-out';

export type EmphasisEffect =
  | 'none'
  | 'pulse'         // general pulse glow
  | 'cash-flow'     // moving pulse along edge
  | 'competitor'    // red tension highlight
  | 'risk'          // warning pulse
  | 'supply-chain'  // directional flow animation
  | 'ownership';    // steady glow

export interface PresentationStep {
  id: string;
  order: number;
  // Target entities
  targetEntityIds: string[];
  // Optional relation-based movement (source → destination)
  sourceEntityId?: string;
  destinationEntityId?: string;
  // Camera
  zoomLevel: number;
  cameraMoveDuration: number;  // ms
  holdDuration: number;        // ms
  transitionType: PresentationTransition;
  emphasisEffect: EmphasisEffect;
  // Bottom note content
  heading: string;
  subheading: string;
  bodyNote: string;
  keyMetrics?: string[];
  whyItMatters?: string;
}

/** 16:9 = landscape PPT-style · 9:16 = portrait short-form/phone */
export type PresentationAspectRatio = '16:9' | '9:16';
export type PresentationBackground = 'world' | 'plain';

export interface Presentation {
  id: string;
  title: string;
  mapId: string;
  background: PresentationBackground;
  aspectRatio: PresentationAspectRatio;
  steps: PresentationStep[];
  createdAt: string;
  updatedAt: string;
}

export const SECTOR_PRESETS = [
  'Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer Discretionary',
  'Consumer Staples', 'Industrials', 'Materials', 'Real Estate', 'Utilities',
  'Communication Services', 'Semiconductors', 'AI / ML', 'Crypto / Blockchain',
  'Defense', 'Macro / Rates', 'Commodities',
];
