'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3-geo';

// Simplified world map paths for major countries as SVG path data
// Using a simplified Robinson-like projection baked as static paths
const WORLD_SVG_URL = 'https://unpkg.com/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  onCountryClick?: (country: string, x: number, y: number) => void;
  children?: React.ReactNode;
  width: number;
  height: number;
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

export default function WorldMap({ onCountryClick, children, width, height }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<Array<{ id: string; path: string; name: string }>>([]);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null);

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
            name: COUNTRY_NAMES[id] || `Country ${id}`,
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
    (e: React.MouseEvent<SVGPathElement>, name: string) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      onCountryClick?.(name, x, y);
    },
    [onCountryClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGPathElement>, name: string) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 32, name });
    },
    []
  );

  return (
    <div className="world-map-container" style={{ width, height }}>
      {/* Ocean background */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Ocean gradient */}
        <defs>
          <radialGradient id="oceanGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0c1f3d" />
            <stop offset="100%" stopColor="#071224" />
          </radialGradient>
          <filter id="countryGlow">
            <feGaussianBlur stdDeviation="1" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} fill="url(#oceanGrad)" />

        {/* Subtle grid lines */}
        {Array.from({ length: 18 }, (_, i) => (
          <line
            key={`lat-${i}`}
            x1={0}
            y1={height * (i / 18)}
            x2={width}
            y2={height * (i / 18)}
            stroke="rgba(59, 130, 246, 0.04)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 36 }, (_, i) => (
          <line
            key={`lon-${i}`}
            x1={width * (i / 36)}
            y1={0}
            x2={width * (i / 36)}
            y2={height}
            stroke="rgba(59, 130, 246, 0.04)"
            strokeWidth={1}
          />
        ))}

        {/* Countries */}
        <g>
          {paths.map(({ id, path, name }, index) => (
            <path
              key={name || id || `country-${index}`}
              d={path}
              className="country-path"
              fill={
                hoveredCountry === name
                  ? 'rgba(59, 130, 246, 0.22)'
                  : 'rgba(30, 58, 95, 0.7)'
              }
              stroke="rgba(59, 130, 246, 0.35)"
              strokeWidth={0.5}
              onClick={(e) => handleCountryClick(e, name)}
              onMouseEnter={() => setHoveredCountry(name)}
              onMouseLeave={() => { setHoveredCountry(null); setTooltip(null); }}
              onMouseMove={(e) => handleMouseMove(e, name)}
            />
          ))}
        </g>
      </svg>

      {/* Country name tooltip */}
      {tooltip && (
        <div
          className="tooltip"
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            pointerEvents: 'none',
          }}
        >
          {tooltip.name}
        </div>
      )}

      {/* Entities & relationships layer */}
      <div style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}>
        {children}
      </div>
    </div>
  );
}
