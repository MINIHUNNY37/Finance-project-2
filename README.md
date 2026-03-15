# StockMapper – Stock Scenario Planner

An interactive world map canvas for stock investors to visually map how companies operate and test different investment scenarios.

## Features

- **Interactive World Map** – 2D world map background (Natural Earth projection) with country highlighting
- **Entity Builder** – Create company entities with icons, names, subtitles, descriptions, and sub-sections
- **Drag & Drop Placement** – Drag entities freely across the map and place them in countries
- **Relationship Arrows** – Draw curved arrows between entities with custom labels and colors
- **Folder Organization** – Organize entities into color-coded folders
- **Save & Share** – Save multiple scenario maps, generate shareable links, export as JSON
- **Google Auth** – Sign in with Google to sync maps across devices
- **Blue Light Theme** – Clean dark blue UI optimized for readability

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required env vars:
```
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

### 3. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the Google+ API
4. Create OAuth 2.0 credentials (Web Application)
5. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **Zustand** – State management with persistence
- **D3-geo** – Map projection and rendering
- **topojson-client** – World map data parsing
- **NextAuth v5** – Google OAuth authentication
- **Lucide React** – Icons

## Usage

1. **Add Entity** – Click the "Add Entity" button or click a country on the map
2. **Edit** – Click an entity to select it, then click the edit (pencil) icon
3. **Connect** – Click "Connect" in the toolbar, then click one entity then another
4. **Edit relationship** – Click on an arrow to select and edit its label/color
5. **Organize** – Use the Folders tab in the sidebar to create folders and assign entities
6. **Save** – Click Save in the toolbar; maps persist in localStorage
7. **Share** – Click Share to generate a share link or export as JSON
