'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3-geo';

const WORLD_SVG_URL = 'https://unpkg.com/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  onCountryClick?: (country: string, x: number, y: number) => void;
  children?: React.ReactNode;
  width: number;
  height: number;
  highlightedCountries?: string[];
}

// Country code to name mapping (ISO 3166-1 numeric)
const COUNTRY_NAMES: Record<string, string> = {
  '004': 'Afghanistan', '008': 'Albania', '012': 'Algeria', '024': 'Angola',
  '032': 'Argentina', '036': 'Australia', '040': 'Austria', '050': 'Bangladesh',
  '056': 'Belgium', '068': 'Bolivia', '076': 'Brazil', '100': 'Bulgaria',
  '116': 'Cambodia', '120': 'Cameroon', '124': 'Canada', '144': 'Sri Lanka',
  '152': 'Chile', '156': 'China', '170': 'Colombia', '180': 'DR Congo',
  '191': 'Croatia', '192': 'Cuba', '196': 'Cyprus', '203': 'Czech Republic',
  '208': 'Denmark', '218': 'Ecuador', '818': 'Egypt', '231': 'Ethiopia',
  '246': 'Finland', '250': 'France', '276': 'Germany', '288': 'Ghana',
  '300': 'Greece', '320': 'Guatemala', '332': 'Haiti', '340': 'Honduras',
  '348': 'Hungary', '356': 'India', '360': 'Indonesia', '364': 'Iran',
  '368': 'Iraq', '372': 'Ireland', '376': 'Israel', '380': 'Italy',
  '388': 'Jamaica', '392': 'Japan', '400': 'Jordan', '398': 'Kazakhstan',
  '404': 'Kenya', '408': 'North Korea', '410': 'South Korea', '414': 'Kuwait',
  '418': 'Laos', '422': 'Lebanon', '434': 'Libya', '484': 'Mexico',
  '504': 'Morocco', '508': 'Mozambique', '516': 'Namibia', '524': 'Nepal',
  '528': 'Netherlands', '554': 'New Zealand', '566': 'Nigeria', '578': 'Norway',
  '512': 'Oman', '586': 'Pakistan', '591': 'Panama', '604': 'Peru',
  '608': 'Philippines', '616': 'Poland', '620': 'Portugal', '630': 'Puerto Rico',
  '634': 'Qatar', '642': 'Romania', '643': 'Russia', '682': 'Saudi Arabia',
  '706': 'Somalia', '710': 'South Africa', '724': 'Spain', '729': 'Sudan',
  '752': 'Sweden', '756': 'Switzerland', '760': 'Syria', '158': 'Taiwan',
  '764': 'Thailand', '788': 'Tunisia', '792': 'Turkey', '800': 'Uganda',
  '804': 'Ukraine', '784': 'UAE', '826': 'United Kingdom', '840': 'United States',
  '858': 'Uruguay', '860': 'Uzbekistan', '862': 'Venezuela', '704': 'Vietnam',
  '887': 'Yemen', '894': 'Zambia', '716': 'Zimbabwe',
};

interface CountryPath {
  id: string;
  path: string;
  name: string;
}

// Renders a single copy of the world map background SVG at a horizontal offset.
// interactive=true means the copy has hover/click handlers (center copy only).
function WorldMapBackground({
  paths,
  hoveredCountry,
  highlightedCountries,
  width,
  height,
  offsetX,
  interactive,
  onCountryClick,
  onHoverEnter,
  onHoverLeave,
  svgIdSuffix,
}: {
  paths: CountryPath[];
  hoveredCountry: string | null;
  highlightedCountries?: string[];
  width: number;
  height: number;
  offsetX: number;
  interactive: boolean;
  onCountryClick?: (name: string, clientX: number, clientY: number) => void;
  onHoverEnter?: (name: string) => void;
  onHoverLeave?: () => void;
  svgIdSuffix: string;
}) {
  const gradId = `oceanGrad${svgIdSuffix}`;
  const filterId = `countryGlow${svgIdSuffix}`;
  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: offsetX,
        pointerEvents: interactive ? 'all' : 'none',
      }}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#0c1f3d" />
          <stop offset="100%" stopColor="#071224" />
        </radialGradient>
        <filter id={filterId}>
          <feGaussianBlur stdDeviation="1" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`hlGlow${svgIdSuffix}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <style>{`
          @keyframes countryPulse${svgIdSuffix} {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
          .hl-country-${svgIdSuffix} {
            animation: countryPulse${svgIdSuffix} 2s ease-in-out infinite;
          }
        `}</style>
      </defs>
      <rect width={width} height={height} fill={`url(#${gradId})`} />

      {/* Subtle grid lines */}
      {Array.from({ length: 18 }, (_, i) => (
        <line
          key={`lat-${i}`}
          x1={0} y1={height * (i / 18)}
          x2={width} y2={height * (i / 18)}
          stroke="rgba(59, 130, 246, 0.04)" strokeWidth={1}
        />
      ))}
      {Array.from({ length: 36 }, (_, i) => (
        <line
          key={`lon-${i}`}
          x1={width * (i / 36)} y1={0}
          x2={width * (i / 36)} y2={height}
          stroke="rgba(59, 130, 246, 0.04)" strokeWidth={1}
        />
      ))}

      {/* Countries */}
      <g>
        {paths.map(({ path, name }, index) => {
          const isHighlighted = highlightedCountries?.includes(name);
          const isHovered = interactive && hoveredCountry === name;
          return (
            <path
              key={`country-${index}`}
              d={path}
              className={isHighlighted ? `country-path hl-country-${svgIdSuffix}` : 'country-path'}
              fill={
                isHighlighted
                  ? 'rgba(251, 191, 36, 0.45)'
                  : isHovered
                    ? 'rgba(59, 130, 246, 0.22)'
                    : 'rgba(30, 58, 95, 0.7)'
              }
              stroke={isHighlighted ? 'rgba(251, 191, 36, 0.8)' : 'rgba(59, 130, 246, 0.35)'}
              strokeWidth={isHighlighted ? 1.2 : 0.5}
              filter={isHighlighted ? `url(#hlGlow${svgIdSuffix})` : undefined}
              onClick={interactive ? (e) => onCountryClick?.(name, e.clientX, e.clientY) : undefined}
              onMouseEnter={interactive ? () => onHoverEnter?.(name) : undefined}
              onMouseLeave={interactive ? () => onHoverLeave?.() : undefined}
            />
          );
        })}
      </g>
    </svg>
  );
}

export default function WorldMap({ onCountryClick, children, width, height, highlightedCountries }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<CountryPath[]>([]);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      try {
        const response = await fetch(WORLD_SVG_URL);
        const world = await response.json();
        const { feature } = await import('topojson-client');

        const projection = d3
          .geoNaturalEarth1()
          .scale((width / (2 * Math.PI)) * 1.1)
          .translate([width / 2, height / 2]);

        const pathGenerator = d3.geoPath().projection(projection);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const countries = feature(world as any, (world as any).objects.countries);

        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const countryPaths = (countries as any).features.map((f: any) => {
          const id = f.id != null ? String(f.id).padStart(3, '0') : null;
          return {
            id,
            path: pathGenerator(f) || '',
            name: (id ? COUNTRY_NAMES[id] : null) || `Country ${id}`,
          };
        });

        setPaths(countryPaths);
      } catch (err) {
        console.error('Failed to load world map', err);
      }
    }

    loadMap();
    return () => { cancelled = true; };
  }, [width, height]);

  const handleCountryClick = useCallback(
    (name: string, clientX: number, clientY: number) => {
      onCountryClick?.(name, clientX, clientY);
    },
    [onCountryClick]
  );

  // We render 3 copies of the background side by side:
  //   left copy  at offsetX = -width  (no interaction)
  //   center copy at offsetX = 0      (interactive — hover + click)
  //   right copy  at offsetX = +width (no interaction)
  //
  // The outer overflow:hidden in MapCanvas clips anything outside the viewport.
  // When the user pans, these copies fill what would otherwise be empty space,
  // creating the illusion of a round world that wraps horizontally.

  return (
    <div
      className="world-map-container"
      ref={svgRef as unknown as React.RefObject<HTMLDivElement>}
      style={{ width, height, position: 'relative', overflow: 'visible' }}
    >
      {/* Left copy — background + country clicks (entities rendered by MapCanvas at offsetX) */}
      <WorldMapBackground
        paths={paths}
        hoveredCountry={hoveredCountry}
        highlightedCountries={highlightedCountries}
        width={width}
        height={height}
        offsetX={-width}
        interactive={true}
        onCountryClick={handleCountryClick}
        onHoverEnter={setHoveredCountry}
        onHoverLeave={() => setHoveredCountry(null)}
        svgIdSuffix="L"
      />

      {/* Center copy — interactive */}
      <WorldMapBackground
        paths={paths}
        hoveredCountry={hoveredCountry}
        highlightedCountries={highlightedCountries}
        width={width}
        height={height}
        offsetX={0}
        interactive={true}
        onCountryClick={handleCountryClick}
        onHoverEnter={setHoveredCountry}
        onHoverLeave={() => setHoveredCountry(null)}
        svgIdSuffix="C"
      />

      {/* Right copy — background + country clicks */}
      <WorldMapBackground
        paths={paths}
        hoveredCountry={hoveredCountry}
        highlightedCountries={highlightedCountries}
        width={width}
        height={height}
        offsetX={width}
        interactive={true}
        onCountryClick={handleCountryClick}
        onHoverEnter={setHoveredCountry}
        onHoverLeave={() => setHoveredCountry(null)}
        svgIdSuffix="R"
      />

      {/* Entities & relationships layer — center only */}
      <div style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}>
        {children}
      </div>
    </div>
  );
}
