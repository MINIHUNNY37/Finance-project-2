export interface EntitySubItem {
  id: string;
  title: string;
  description: string;
}

export interface EntityStatistic {
  id: string;
  name: string;   // template label e.g. "Revenue", "P/E Ratio" — this is what gets saved
  value: string;  // current figure e.g. "$394B"
}

export interface Entity {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  description: string;
  subItems: EntitySubItem[];
  statistics: EntityStatistic[];
  color: string;
  country: string;
  position: { x: number; y: number };
  locked?: boolean;
  folderId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  entityIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface ScenarioMap {
  id: string;
  name: string;
  description: string;
  entities: Entity[];
  relationships: Relationship[];
  folders: Folder[];
  ownerId: string;
  sharedWith: string[];
  shareToken?: string;
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
