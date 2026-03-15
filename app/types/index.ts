export interface EntitySubItem {
  id: string;
  title: string;
  description: string;
}

export interface Entity {
  id: string;
  name: string;
  icon: string;
  subtitle: string;
  description: string;
  subItems: EntitySubItem[];
  color: string;
  country: string; // country name where placed
  position: { x: number; y: number }; // pixel position on map
  folderId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  label: string;
  description: string;
  color: string;
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
  sharedWith: string[]; // user IDs or emails
  shareToken?: string; // public share token
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
  '#3B82F6', // blue
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
];

export const RELATIONSHIP_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
];
