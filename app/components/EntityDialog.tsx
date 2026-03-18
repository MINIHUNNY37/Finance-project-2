'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, BarChart2, Search, RefreshCw, TrendingUp, TrendingDown, CheckCircle, XCircle, Clock, Star, ExternalLink, LinkIcon, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Entity, EntitySubItem, EntityStatistic, EntityCatalyst, EntityLink } from '../types';
import { ENTITY_ICONS, ENTITY_COLORS, SECTOR_PRESETS } from '../types';
import { useMapStore } from '../store/mapStore';

interface EntityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Entity>) => void;
  initialData?: Partial<Entity>;
  defaultPosition?: { x: number; y: number };
  defaultCountry?: string;
}

type Tab = 'basic' | 'details' | 'stats' | 'invest';

const STAT_CATEGORIES: { id: string; label: string; presets: string[] }[] = [
  { id: 'income',    label: 'Income',     presets: ['Revenue', 'Net Income', 'Gross Profit', 'Operating Income', 'EBITDA'] },
  { id: 'balance',   label: 'Balance',    presets: ['Total Assets', 'Total Liabilities', 'Book Value', 'Cash & Equiv.', 'Debt/Equity'] },
  { id: 'valuation', label: 'Valuation',  presets: ['Market Cap', 'P/E Ratio', 'EPS', 'P/B Ratio', 'EV/EBITDA'] },
  { id: 'dividend',  label: 'Dividends',  presets: ['Dividend Yield', 'Dividend/Share', 'Payout Ratio'] },
  { id: 'ops',       label: 'Operations', presets: ['Employees', 'ROE', 'ROA', 'Profit Margin', 'FCF'] },
];

// Top 5 most investor-relevant stats per entity icon
const KEY_STATS_BY_ICON: Record<string, string[]> = {
  '🏢': ['Revenue', 'Net Income', 'P/E Ratio', 'Market Cap', 'EPS'],
  '🏭': ['Revenue', 'EBITDA', 'Operating Margin', 'CapEx', 'Gross Profit'],
  '🏦': ['Net Interest Margin', 'ROE', 'Book Value', 'NPL Ratio', 'Tier 1 Capital'],
  '🛢️': ['Production (bbl/d)', 'Proven Reserves', 'EBITDA', 'Break-even Price', 'Revenue'],
  '⚡': ['Capacity (GW)', 'Revenue', 'EBITDA', 'CapEx', 'ROE'],
  '💊': ['Revenue', 'R&D Spend', 'Pipeline Count', 'Gross Margin', 'EPS'],
  '🚗': ['Vehicle Deliveries', 'Revenue', 'EBITDA Margin', 'Free Cash Flow', 'Gross Margin'],
  '✈️': ['Passengers (PAX)', 'Revenue', 'EBITDA', 'Load Factor', 'Operating Margin'],
  '🚢': ['Revenue', 'TEU Volume', 'EBITDA', 'Fleet Size', 'Freight Rates'],
  '💻': ['Revenue Growth', 'Gross Margin', 'ARR', 'Free Cash Flow', 'P/E Ratio'],
  '📱': ['MAU / DAU', 'Revenue', 'ARPU', 'Gross Margin', 'Free Cash Flow'],
  '🌾': ['Production Volume', 'Revenue', 'EBITDA', 'Yield/Acre', 'CapEx'],
  '⛏️': ['Production (oz/t)', 'AISC', 'Revenue', 'EBITDA', 'Reserves'],
  '🏗️': ['Order Backlog', 'Revenue', 'EBITDA Margin', 'New Orders', 'ROE'],
  '🛒': ['Same-Store Sales', 'Revenue', 'Gross Margin', 'Inventory Turns', 'EBITDA'],
  '📺': ['Subscribers', 'Revenue', 'ARPU', 'Churn Rate', 'EBITDA'],
  '🔬': ['Revenue', 'R&D Spend', 'Gross Margin', 'Pipeline Count', 'EPS'],
  '🏥': ['Revenue', 'Patient Volume', 'EBITDA', 'Operating Margin', 'ROE'],
  '🌐': ['Revenue', 'Market Cap', 'P/E Ratio', 'EBITDA', 'Free Cash Flow'],
  '💰': ['AUM', 'Revenue', 'ROE', 'P/E Ratio', 'Dividend Yield'],
  '📦': ['Revenue', 'Volume (TEU)', 'EBITDA', 'On-time Delivery %', 'CapEx'],
  '🔋': ['Capacity (GWh)', 'Revenue', 'Gross Margin', 'CapEx', 'Market Share'],
  '🌱': ['Revenue', 'Carbon Credits', 'EBITDA', 'ESG Score', 'CapEx'],
  '🏨': ['RevPAR', 'Revenue', 'EBITDA Margin', 'Occupancy Rate', 'ADR'],
};

// Simple explanations for key stats (hover tooltips)
const STAT_DESCRIPTIONS: Record<string, string> = {
  'Revenue': 'All the money a company earns from selling stuff. Like counting every dollar from your lemonade stand.',
  'Net Income': "What's left after paying all the bills. If you earned $10 and spent $7, your net income is $3.",
  'P/E Ratio': 'How much people pay for each $1 of profit. Higher means investors expect big growth ahead.',
  'Market Cap': 'Total price of all shares added together — how much the whole company is worth right now.',
  'EPS': 'Earnings Per Share — how much profit each single share earns. More is better!',
  'EBITDA': 'Profit before interest, taxes, and some big costs are taken out. Shows how well the core business runs.',
  'Operating Margin': 'How many cents the company keeps as profit from every dollar it earns. Bigger means more efficient.',
  'CapEx': 'Money spent on big equipment or buildings to grow the business. Like buying a better lemonade cart.',
  'Gross Profit': 'Sales minus the direct cost to make the product — the first level of profit before other expenses.',
  'Net Interest Margin': 'For banks: the gap between what they earn on loans vs what they pay on savings. Bigger gap = more profit.',
  'ROE': 'Return on Equity — how much profit the company earns with the money shareholders put in.',
  'Book Value': "The company's total stuff minus everything it owes. Like counting your toys minus money you borrowed.",
  'NPL Ratio': "Non-Performing Loans — how many bank loans aren't being repaid. Lower is much safer.",
  'Tier 1 Capital': "A bank's safety cushion for hard times. Thicker cushion means a safer, stronger bank.",
  'Production (bbl/d)': 'Barrels of oil pumped every day. More barrels usually means more money.',
  'Proven Reserves': 'Oil or minerals confirmed underground. Like knowing exactly how many cookies are left in the jar.',
  'Break-even Price': 'The oil price needed to just cover costs. Below this price the company loses money.',
  'Capacity (GW)': 'Maximum electricity the company can generate — like how many light bulbs it could power at once.',
  'R&D Spend': 'Money spent inventing new things. Companies investing here are planning for the future.',
  'Pipeline Count': 'Number of new drugs or products in development. More pipeline = more chances of future hits.',
  'Gross Margin': 'Percentage of revenue left after making the product. Shows how efficient production is.',
  'Vehicle Deliveries': 'How many cars were actually handed to customers this period. More deliveries = more revenue.',
  'EBITDA Margin': 'EBITDA as a percent of revenue. Shows how profitable the core operations are.',
  'Free Cash Flow': 'Cash left after all spending — money the company can invest or give back to shareholders.',
  'Passengers (PAX)': 'Number of people who flew. More passengers means more ticket and fee revenue.',
  'Load Factor': 'How full the planes are on average. 85% means 85 out of every 100 seats had a passenger.',
  'TEU Volume': 'Number of standard shipping containers moved. Bigger volume means bigger business.',
  'Fleet Size': 'How many ships or planes owned. A bigger fleet can carry more goods and earn more.',
  'Freight Rates': 'How much it costs to ship a container. Higher rates mean more revenue for the shipper.',
  'Revenue Growth': 'How fast sales are growing vs last year. Fast growth means the company is winning more customers.',
  'ARR': 'Annual Recurring Revenue — reliable yearly income from subscriptions. More predictable than one-time sales.',
  'MAU / DAU': 'Monthly / Daily Active Users — how many people use the app regularly. More users usually means more revenue.',
  'ARPU': 'Average Revenue Per User — how much money each user brings in. Higher means the product is more valuable.',
  'Churn Rate': 'How many subscribers cancel each month. Lower churn means happier, stickier customers.',
  'Production Volume': 'How much the company produces (crops, goods). Higher volume usually means more revenue.',
  'Yield/Acre': 'How many crops grow per acre of land. Higher yield means smarter, more efficient farming.',
  'Production (oz/t)': 'Ounces of gold or silver mined per tonne of rock. Higher grade means cheaper cost per ounce.',
  'AISC': 'All-In Sustaining Cost — total cost to mine one ounce. If this is below the gold price, they profit.',
  'Reserves': 'Confirmed minerals still in the ground. More reserves means the company can keep mining longer.',
  'Order Backlog': 'Future work already contracted. Like having a big stack of orders waiting to be filled.',
  'New Orders': 'Fresh contracts signed recently. Growing new orders signal strong future revenue.',
  'Same-Store Sales': 'Sales growth at stores open over a year. Shows if the business is getting stronger, not just bigger.',
  'Inventory Turns': 'How quickly products sell and get restocked. Fast turns means less waste and more efficiency.',
  'Subscribers': 'Total paying members. More subscribers means more predictable monthly income.',
  'Patient Volume': 'Number of patients treated. More patients means more healthcare revenue for the company.',
  'AUM': 'Assets Under Management — total money clients trust the firm to invest. Bigger AUM earns more fees.',
  'Dividend Yield': 'Annual dividend as a % of share price. Like interest on a savings account for investors.',
  'Volume (TEU)': 'Shipping containers handled — shows the scale of the logistics operation.',
  'On-time Delivery %': 'Percentage of deliveries arriving on schedule. Higher means more reliable and happier customers.',
  'Capacity (GWh)': 'Total battery energy that can be stored or produced. Shows scale of the energy business.',
  'Market Share': 'Percentage of total industry sales the company has. More share means a stronger competitive position.',
  'Carbon Credits': 'Credits earned by cutting CO2 emissions. Can be sold for extra income.',
  'ESG Score': 'Environmental, Social, Governance score — how responsibly the company behaves. Higher is better.',
  'RevPAR': 'Revenue Per Available Room — how much each hotel room earns on average per night.',
  'Occupancy Rate': 'Percentage of hotel rooms that have guests. 90% means 9 out of 10 rooms are filled.',
  'ADR': 'Average Daily Rate — average price charged per room per night. Higher means more premium positioning.',
  'Profit Margin': 'Percentage of revenue that becomes profit. Keeping 20 cents from every dollar earned.',
  'FCF': 'Free Cash Flow — cash left after all business spending. The best sign of a truly healthy company.',
  'Employees': 'Total number of workers. Can show company size, but too many can hurt profitability.',
  'ROA': 'Return on Assets — how efficiently the company turns what it owns into profit.',
  'Dividend/Share': 'How much cash the company pays you for each share you own, every year.',
  'Payout Ratio': 'Percentage of profits paid out as dividends. Very high ratios can be hard to sustain.',
  'Total Assets': 'Everything the company owns — buildings, cash, equipment. Bigger usually means bigger business.',
  'Total Liabilities': 'Everything the company owes. Lower relative to assets means a stronger financial position.',
  'Cash & Equiv.': 'Money the company has on hand right now. More cash means more safety and flexibility.',
  'Debt/Equity': 'How much the company borrowed vs how much shareholders own. Lower means less financial risk.',
  'P/B Ratio': 'Price-to-Book — share price vs book value per share. Under 1 can mean the stock is cheap.',
  'EV/EBITDA': 'Enterprise Value divided by EBITDA — a popular way to compare if a company is cheap or expensive.',
};

export default function EntityDialog({
  isOpen, onClose, onSave, initialData, defaultPosition, defaultCountry,
}: EntityDialogProps) {
  const {
    customStatPresets, addCustomStatPreset, removeCustomStatPreset,
    customDetailPresets, addCustomDetailPreset, removeCustomDetailPreset,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [showAdvancedInvest, setShowAdvancedInvest] = useState(false);
  const [hoveredKeyStat, setHoveredKeyStat] = useState<string | null>(null);
  const [newStatPreset, setNewStatPreset] = useState('');
  const [newDetailPreset, setNewDetailPreset] = useState('');
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏢');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(ENTITY_COLORS[0]);
  const [subItems, setSubItems] = useState<EntitySubItem[]>([]);
  const [statistics, setStatistics] = useState<EntityStatistic[]>([]);
  const [country, setCountry] = useState('');
  // Ticker / live price
  const [ticker, setTicker] = useState('');
  const [livePrice, setLivePrice] = useState<number | undefined>();
  const [priceChange, setPriceChange] = useState<number | undefined>();
  const [priceChangePct, setPriceChangePct] = useState<number | undefined>();
  const [marketCap, setMarketCap] = useState('');
  const [peRatio, setPeRatio] = useState('');
  const [week52Low, setWeek52Low] = useState<number | undefined>();
  const [week52High, setWeek52High] = useState<number | undefined>();
  const [lastPriceFetch, setLastPriceFetch] = useState<string | undefined>();
  const [tickerFetching, setTickerFetching] = useState(false);
  const [tickerError, setTickerError] = useState('');
  // Investment thesis
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [entryPrice, setEntryPrice] = useState<string>('');
  // Thesis log
  const [thesis, setThesis] = useState('');
  const [exitCriteria, setExitCriteria] = useState('');
  const [conviction, setConviction] = useState<number>(0);
  // Catalysts
  const [catalysts, setCatalysts] = useState<EntityCatalyst[]>([]);
  // Sector / tags
  const [sector, setSector] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  // Links
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setIcon(initialData.icon || '🏢');
      setSubtitle(initialData.subtitle || '');
      setDescription(initialData.description || '');
      setColor(initialData.color || ENTITY_COLORS[0]);
      setSubItems(initialData.subItems || []);
      setStatistics(initialData.statistics || []);
      setCountry(initialData.country || defaultCountry || '');
      setTicker(initialData.ticker || '');
      setLivePrice(initialData.livePrice);
      setPriceChange(initialData.priceChange);
      setPriceChangePct(initialData.priceChangePct);
      setMarketCap(initialData.marketCap || '');
      setPeRatio(initialData.peRatio || '');
      setWeek52Low(initialData.week52Low);
      setWeek52High(initialData.week52High);
      setLastPriceFetch(initialData.lastPriceFetch);
      setTargetPrice(initialData.targetPrice != null ? String(initialData.targetPrice) : '');
      setEntryPrice(initialData.entryPrice != null ? String(initialData.entryPrice) : '');
      setThesis(initialData.thesis || '');
      setExitCriteria(initialData.exitCriteria || '');
      setConviction(initialData.conviction || 0);
      setCatalysts(initialData.catalysts || []);
      setSector(initialData.sector || '');
      setTags(initialData.tags || []);
      setLinks(initialData.links || []);
    } else {
      // Empty icon forces the user to explicitly pick one before saving
      setName(''); setIcon(''); setSubtitle(''); setDescription('');
      setColor(ENTITY_COLORS[0]); setSubItems([]); setStatistics([]);
      setCountry(defaultCountry || '');
      setTicker(''); setLivePrice(undefined); setPriceChange(undefined);
      setPriceChangePct(undefined); setMarketCap(''); setPeRatio('');
      setWeek52Low(undefined); setWeek52High(undefined); setLastPriceFetch(undefined);
      setTargetPrice(''); setEntryPrice('');
      setThesis(''); setExitCriteria(''); setConviction(0);
      setCatalysts([]); setSector(''); setTags([]);
      setLinks([]); setLinkUrl(''); setLinkTitle('');
    }
    setTickerError('');
    setActiveTab('basic');
  }, [initialData, defaultCountry, isOpen]);

  if (!isOpen) return null;

  // Fetch live stock data
  const handleFetchTicker = async () => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return;
    setTickerFetching(true);
    setTickerError('');
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}`);
      if (!res.ok) {
        const err = await res.json();
        setTickerError(err.error || 'Failed to fetch');
      } else {
        const data = await res.json();
        setLivePrice(data.price);
        setPriceChange(data.change);
        setPriceChangePct(data.changePct);
        setMarketCap(data.marketCap);
        setPeRatio(data.peRatio);
        setWeek52Low(data.week52Low);
        setWeek52High(data.week52High);
        setLastPriceFetch(new Date().toISOString());
        setTickerError('');
      }
    } catch {
      setTickerError('Network error');
    } finally {
      setTickerFetching(false);
    }
  };

  // Sub-items
  const addSubItem = () => setSubItems([...subItems, { id: uuidv4(), title: '', description: '' }]);
  const updateSubItem = (id: string, field: keyof EntitySubItem, value: string) =>
    setSubItems(subItems.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  const removeSubItem = (id: string) => setSubItems(subItems.filter((s) => s.id !== id));

  // Statistics
  const addStat = () => setStatistics([...statistics, { id: uuidv4(), name: '', value: '', asOf: '' }]);
  const updateStat = (id: string, field: keyof EntityStatistic, value: string) =>
    setStatistics(statistics.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  const removeStat = (id: string) => setStatistics(statistics.filter((s) => s.id !== id));

  const handleSave = () => {
    if (!name.trim() || !icon) return;
    const tp = parseFloat(targetPrice);
    const ep = parseFloat(entryPrice);
    onSave({
      name: name.trim(), icon, subtitle: subtitle.trim(),
      description: description.trim(), color, subItems, statistics,
      country: country.trim(),
      position: defaultPosition || { x: 400, y: 300 },
      ticker: ticker.trim().toUpperCase() || undefined,
      livePrice, priceChange, priceChangePct,
      marketCap: marketCap || undefined,
      peRatio: peRatio || undefined,
      week52Low, week52High, lastPriceFetch,
      targetPrice: !isNaN(tp) && targetPrice !== '' ? tp : undefined,
      entryPrice: !isNaN(ep) && entryPrice !== '' ? ep : undefined,
      thesis: thesis.trim() || undefined,
      exitCriteria: exitCriteria.trim() || undefined,
      conviction: conviction > 0 ? conviction : undefined,
      catalysts: catalysts.length > 0 ? catalysts : undefined,
      sector: sector || undefined,
      tags: tags.length > 0 ? tags : undefined,
      links: links.length > 0 ? links : undefined,
    });
    onClose();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'basic', label: 'Basic' },
    { id: 'details', label: 'Details' },
    { id: 'stats', label: 'Statistics' },
    { id: 'invest', label: 'Invest' },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel fade-in" style={{
        width: '100%', maxWidth: 540, borderRadius: 16, padding: 0,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid rgba(59,130,246,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ color: '#93c5fd', fontSize: 18, fontWeight: 700 }}>
              {initialData?.id ? 'Edit Entity' : 'Create Entity'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0' }}>
              <X size={20} />
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '8px 4px', background: 'none', border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#3b82f6' : 'transparent'}`,
                color: activeTab === tab.id ? '#3b82f6' : '#94a3b8',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {tab.label}
                {tab.id === 'stats' && statistics.length > 0 && (
                  <span style={{
                    marginLeft: 5, background: '#3b82f6', color: 'white',
                    borderRadius: 8, padding: '1px 5px', fontSize: 10,
                  }}>{statistics.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* === BASIC TAB === */}
          {activeTab === 'basic' && (
            <>
              {/* Icon picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Icon
                  {!icon && (
                    <span style={{ marginLeft: 6, color: '#ef4444', fontSize: 10, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                      — required
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {ENTITY_ICONS.map((ic) => (
                    <button key={ic.value} title={ic.label} onClick={() => setIcon(ic.value)} style={{
                      width: 38, height: 38, borderRadius: 8,
                      border: icon === ic.value ? '2px solid #06b6d4' : '1px solid rgba(59,130,246,0.2)',
                      background: icon === ic.value ? 'rgba(6,182,212,0.15)' : 'rgba(15,23,42,0.6)',
                      fontSize: 19, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s ease',
                    }}>
                      {ic.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entity Type */}
              <div style={{ marginTop: 10, marginBottom: 16 }}>
                <label style={labelStyle}>Entity Type</label>
                <div style={{
                  marginTop: 8, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(15,23,42,0.5)',
                  border: `1px solid ${icon ? `${color}44` : 'rgba(59,130,246,0.15)'}`,
                }}>
                  {icon
                    ? <>
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: color }}>
                          {ENTITY_ICONS.find((ic) => ic.value === icon)?.label ?? 'Custom'}
                        </span>
                      </>
                    : <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                        Select an icon above to set the entity type
                      </span>
                  }
                </div>
              </div>

              {/* Color */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Color</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {ENTITY_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} style={{
                      width: 30, height: 30, borderRadius: '50%', background: c,
                      border: color === c ? '3px solid white' : '2px solid transparent',
                      cursor: 'pointer', boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                      transition: 'all 0.15s ease',
                    }} />
                  ))}
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Name *</label>
                <input className="input-field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apple Inc." />
              </div>

              {/* Subtitle */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Subtitle</label>
                <input className="input-field mt-1" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Technology Giant · $AAPL" />
              </div>

              {/* Country */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Country / Location</label>
                <input className="input-field mt-1" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Description</label>
                <textarea className="input-field mt-1" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Business model, role in the scenario..." rows={3} style={{ resize: 'vertical' }} />
              </div>
            </>
          )}

          {/* === DETAILS TAB === */}
          {activeTab === 'details' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={labelStyle}>Sub-sections</label>
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addSubItem}>
                  <Plus size={12} style={{ display: 'inline', marginRight: 4 }} />Add
                </button>
              </div>

              {/* Quick add preset sub-sections */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#8899b0', marginBottom: 6 }}>Quick add:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {['Revenue Streams', 'Key Risks', 'Customers', 'Competitors', 'Operations', 'Products', 'Key People', 'Supply Chain'].map((preset) => (
                    <button key={preset}
                      onClick={() => setSubItems([...subItems, { id: uuidv4(), title: preset, description: '' }])}
                      style={{
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#93c5fd', cursor: 'pointer',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.2)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.1)'}
                    >
                      + {preset}
                    </button>
                  ))}
                  {/* User-saved custom detail presets */}
                  {customDetailPresets.map((preset) => (
                    <span key={preset} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={() => setSubItems([...subItems, { id: uuidv4(), title: preset, description: '' }])}
                        style={{
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '6px 0 0 6px', padding: '3px 8px', fontSize: 11, color: '#6ee7b7', cursor: 'pointer',
                        }}
                      >+ {preset}</button>
                      <button
                        onClick={() => removeCustomDetailPreset(preset)}
                        title="Remove preset"
                        style={{
                          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                          borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '3px 5px',
                          fontSize: 10, color: '#8899b0', cursor: 'pointer',
                        }}
                      >×</button>
                    </span>
                  ))}
                </div>
                {/* Add custom preset */}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    className="input-field"
                    value={newDetailPreset}
                    onChange={(e) => setNewDetailPreset(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newDetailPreset.trim()) {
                        addCustomDetailPreset(newDetailPreset.trim());
                        setSubItems([...subItems, { id: uuidv4(), title: newDetailPreset.trim(), description: '' }]);
                        setNewDetailPreset('');
                      }
                    }}
                    placeholder="Save custom preset…"
                    style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  />
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
                    disabled={!newDetailPreset.trim()}
                    onClick={() => {
                      if (!newDetailPreset.trim()) return;
                      addCustomDetailPreset(newDetailPreset.trim());
                      setSubItems([...subItems, { id: uuidv4(), title: newDetailPreset.trim(), description: '' }]);
                      setNewDetailPreset('');
                    }}
                  >
                    <Plus size={11} style={{ display: 'inline', marginRight: 3 }} />Save & Add
                  </button>
                </div>
              </div>

              {subItems.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                  No sub-sections yet. Use quick add above or click Add.
                </div>
              )}
              {subItems.map((sub) => (
                <div key={sub.id} style={{
                  background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 10, padding: 12, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input className="input-field" value={sub.title}
                      onChange={(e) => updateSubItem(sub.id, 'title', e.target.value)}
                      placeholder="Heading (e.g. Revenue Streams)" style={{ flex: 1 }} />
                    <button onClick={() => removeSubItem(sub.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea className="input-field" value={sub.description}
                    onChange={(e) => updateSubItem(sub.id, 'description', e.target.value)}
                    placeholder="Description..." rows={2} style={{ resize: 'vertical', marginBottom: 6 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>Date</span>
                    <input
                      type="date"
                      value={sub.date || ''}
                      onChange={(e) => updateSubItem(sub.id, 'date', e.target.value)}
                      style={{
                        flex: 1, fontSize: 11, padding: '3px 7px',
                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 6, color: '#94a3b8', outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === INVEST TAB === */}
          {activeTab === 'invest' && (() => {
            const tp = parseFloat(targetPrice);
            const ep = parseFloat(entryPrice);
            const base = livePrice ?? ep;
            const upsidePct = base && !isNaN(tp) && targetPrice !== '' ? ((tp - base) / base) * 100 : null;
            const mosPct = !isNaN(tp) && !isNaN(ep) && targetPrice !== '' && entryPrice !== '' && tp > 0
              ? ((tp - ep) / tp) * 100 : null;
            const upsideColor = upsidePct == null ? '#94a3b8' : upsidePct >= 20 ? '#22c55e' : upsidePct >= 5 ? '#84cc16' : upsidePct >= -5 ? '#f59e0b' : '#ef4444';
            return (
              <div>
                {/* ── Ticker section ── */}
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Ticker Symbol</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input className="input-field" value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFetchTicker(); }}
                      placeholder="e.g. AAPL, TSLA"
                      style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em' }} />
                    <button onClick={handleFetchTicker} disabled={!ticker.trim() || tickerFetching}
                      style={{ padding: '6px 14px', borderRadius: 8, cursor: ticker.trim() && !tickerFetching ? 'pointer' : 'not-allowed',
                        background: ticker.trim() && !tickerFetching ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.05)',
                        border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd',
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      {tickerFetching ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
                      {tickerFetching ? 'Fetching…' : 'Fetch'}
                    </button>
                  </div>
                  {tickerError && <div style={{ marginTop: 5, fontSize: 11, color: '#ef4444' }}>{tickerError}</div>}
                </div>

                {/* Live price display */}
                {livePrice != null && (
                  <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(15,23,42,0.7)',
                    border: `1px solid ${entity_color_or_default(color)}44`, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Live Price</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>${livePrice.toFixed(2)}</div>
                      </div>
                      {priceChangePct != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600,
                          color: priceChangePct >= 0 ? '#22c55e' : '#ef4444' }}>
                          {priceChangePct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
                          <span style={{ fontSize: 11, fontWeight: 400 }}>
                            ({priceChange != null ? (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) : ''})
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginTop: 12 }}>
                      {[['Market Cap', marketCap || '—'], ['P/E Ratio', peRatio || '—'],
                        ['52W Low', week52Low != null ? `$${week52Low.toFixed(2)}` : '—'],
                        ['52W High', week52High != null ? `$${week52High.toFixed(2)}` : '—'],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{label}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {lastPriceFetch && <div style={{ fontSize: 10, color: '#8899b0', marginTop: 8 }}>Last updated: {new Date(lastPriceFetch).toLocaleString()}</div>}
                  </div>
                )}

                {/* ── Conviction Score ── */}
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Conviction (1–5)</label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setConviction(conviction === n ? 0 : n)}
                        style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: n <= conviction ? `${color}25` : 'rgba(15,23,42,0.5)',
                          border: `1px solid ${n <= conviction ? color : 'rgba(59,130,246,0.2)'}`,
                          transition: 'all 0.12s' }}>
                        <Star size={16} fill={n <= conviction ? color : 'none'}
                          color={n <= conviction ? color : '#8899b0'} />
                      </button>
                    ))}
                    {conviction > 0 && (
                      <span style={{ fontSize: 11, color: '#8899b0', alignSelf: 'center', marginLeft: 4 }}>
                        {['', 'Very Low', 'Low', 'Moderate', 'High', 'Very High'][conviction]}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Price Targets ── */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Entry Price</label>
                    <input className="input-field mt-1" type="number" step="0.01" value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)} placeholder="e.g. 150.00" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Target Price</label>
                    <input className="input-field mt-1" type="number" step="0.01" value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)} placeholder="e.g. 220.00" />
                  </div>
                </div>

                {/* Upside / MoS display */}
                {(upsidePct != null || mosPct != null) && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 18,
                    background: `${upsideColor}18`, border: `1px solid ${upsideColor}44` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      {upsidePct != null && (
                        <div>
                          <div style={{ fontSize: 10, color: '#8899b0', marginBottom: 4 }}>
                            Upside {livePrice != null ? '(from current)' : '(from entry)'}
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: upsideColor }}>
                            {upsidePct >= 0 ? '+' : ''}{upsidePct.toFixed(1)}%
                          </div>
                        </div>
                      )}
                      {mosPct != null && (
                        <div>
                          <div style={{ fontSize: 10, color: '#8899b0', marginBottom: 4 }}>Margin of Safety</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: mosPct >= 20 ? '#22c55e' : mosPct >= 0 ? '#f59e0b' : '#ef4444' }}>
                            {mosPct.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Thesis Log ── */}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Investment Thesis — Why I Own This</label>
                  <textarea className="input-field mt-1" value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    placeholder="Dominant AI infrastructure play. Data center revenue growing 100%+ YoY..."
                    rows={3} style={{ resize: 'vertical' }} />
                </div>

                {/* ── Advanced Invest (collapsible) ── */}
                <div style={{ marginBottom: 14 }}>
                  <button
                    onClick={() => setShowAdvancedInvest((v) => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
                      color: showAdvancedInvest ? '#3b82f6' : '#94a3b8',
                      width: '100%', justifyContent: 'space-between',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Star size={11} /> Advanced Details
                      <span style={{ fontSize: 10, color: '#8899b0' }}>— sector, tags, catalysts &amp; more</span>
                    </span>
                    <ChevronDown size={11} style={{ transform: showAdvancedInvest ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>

                  {showAdvancedInvest && (
                    <div className="fade-in" style={{ marginTop: 10 }}>
                      {/* Sector */}
                      <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>Sector</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                          {SECTOR_PRESETS.map((s) => (
                            <button key={s} onClick={() => setSector(sector === s ? '' : s)}
                              style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                                background: sector === s ? `${color}30` : 'rgba(59,130,246,0.06)',
                                border: `1px solid ${sector === s ? color : 'rgba(59,130,246,0.2)'}`,
                                color: sector === s ? color : '#8899b0', fontWeight: sector === s ? 600 : 400 }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tags */}
                      <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>Tags / Themes</label>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <input className="input-field" value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && tagInput.trim()) {
                                if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
                                setTagInput('');
                              }
                            }}
                            placeholder="e.g. AI Infrastructure, EV, Cyclical" style={{ flex: 1, fontSize: 11 }} />
                          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                            disabled={!tagInput.trim()}
                            onClick={() => { if (tagInput.trim() && !tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]); setTagInput(''); }}>
                            <Plus size={11} />
                          </button>
                        </div>
                        {tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                            {tags.map((t) => (
                              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 6,
                                padding: '2px 8px', fontSize: 10, color: `${color}cc` }}>
                                {t}
                                <button onClick={() => setTags(tags.filter((x) => x !== t))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899b0', padding: 0 }}>
                                  <X size={9} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Exit Criteria */}
                      <div style={{ marginBottom: 18 }}>
                        <label style={labelStyle}>Exit Criteria — What Would Change My Mind</label>
                        <textarea className="input-field mt-1" value={exitCriteria}
                          onChange={(e) => setExitCriteria(e.target.value)}
                          placeholder="Revenue growth decelerates below 30%. Competition from AMD closes gap..."
                          rows={2} style={{ resize: 'vertical' }} />
                      </div>

                      {/* Catalyst Checklist */}
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <label style={labelStyle}>Catalyst Checklist</label>
                          <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => setCatalysts([...catalysts, {
                              id: uuidv4(), event: '', status: 'pending', createdAt: new Date().toISOString(),
                            }])}>
                            <Plus size={11} style={{ display: 'inline', marginRight: 3 }} />Add
                          </button>
                        </div>
                        {catalysts.length === 0 && (
                          <div style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: '8px 0' }}>
                            Track upcoming events: earnings, product launches, rate decisions...
                          </div>
                        )}
                        {catalysts.map((cat) => {
                          const statusIcon = cat.status === 'hit' ? <CheckCircle size={13} style={{ color: '#22c55e' }} />
                            : cat.status === 'miss' ? <XCircle size={13} style={{ color: '#ef4444' }} />
                            : <Clock size={13} style={{ color: '#f59e0b' }} />;
                          return (
                            <div key={cat.id} style={{
                              padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                              background: 'rgba(15,23,42,0.5)',
                              border: `1px solid ${cat.status === 'hit' ? 'rgba(34,197,94,0.25)' : cat.status === 'miss' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.15)'}`,
                            }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                <button onClick={() => {
                                  const next = cat.status === 'pending' ? 'hit' : cat.status === 'hit' ? 'miss' : 'pending';
                                  setCatalysts(catalysts.map((c) => c.id === cat.id ? { ...c, status: next as EntityCatalyst['status'] } : c));
                                }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                                  title={`Status: ${cat.status} (click to cycle)`}>
                                  {statusIcon}
                                </button>
                                <input className="input-field" value={cat.event}
                                  onChange={(e) => setCatalysts(catalysts.map((c) => c.id === cat.id ? { ...c, event: e.target.value } : c))}
                                  placeholder="Event (e.g. Q3 Earnings)"
                                  style={{ flex: 1, fontSize: 11 }} />
                                <input type="date" value={cat.expectedDate || ''}
                                  onChange={(e) => setCatalysts(catalysts.map((c) => c.id === cat.id ? { ...c, expectedDate: e.target.value } : c))}
                                  style={{ fontSize: 10, padding: '3px 6px', background: 'rgba(15,23,42,0.6)',
                                    border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, color: '#94a3b8', colorScheme: 'dark' }} />
                                <button onClick={() => setCatalysts(catalysts.filter((c) => c.id !== cat.id))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              {cat.status !== 'pending' && (
                                <input className="input-field" value={cat.outcome || ''}
                                  onChange={(e) => setCatalysts(catalysts.map((c) => c.id === cat.id ? { ...c, outcome: e.target.value } : c))}
                                  placeholder={`Outcome: what actually happened?`}
                                  style={{ fontSize: 11, marginLeft: 26 }} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Research Links */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <label style={labelStyle}>Research Links</label>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <input className="input-field" value={linkTitle}
                            onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title" style={{ flex: 1, fontSize: 11 }} />
                          <input className="input-field" value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && linkUrl.trim()) {
                                setLinks([...links, { id: uuidv4(), url: linkUrl.trim(), title: linkTitle.trim() || linkUrl.trim(), addedAt: new Date().toISOString() }]);
                                setLinkUrl(''); setLinkTitle('');
                              }
                            }}
                            style={{ flex: 2, fontSize: 11 }} />
                          <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                            disabled={!linkUrl.trim()}
                            onClick={() => {
                              if (!linkUrl.trim()) return;
                              setLinks([...links, { id: uuidv4(), url: linkUrl.trim(), title: linkTitle.trim() || linkUrl.trim(), addedAt: new Date().toISOString() }]);
                              setLinkUrl(''); setLinkTitle('');
                            }}>
                            <Plus size={11} />
                          </button>
                        </div>
                        {links.map((lnk) => (
                          <div key={lnk.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 7,
                            background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(59,130,246,0.12)', marginBottom: 4,
                          }}>
                            <LinkIcon size={10} style={{ color: '#3b82f6', flexShrink: 0 }} />
                            <a href={lnk.url} target="_blank" rel="noopener noreferrer"
                              style={{ flex: 1, fontSize: 11, color: '#93c5fd', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              onClick={(e) => e.stopPropagation()}>
                              {lnk.title} <ExternalLink size={9} style={{ display: 'inline', marginLeft: 3 }} />
                            </a>
                            <button onClick={() => setLinks(links.filter((l) => l.id !== lnk.id))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* === STATISTICS TAB === */}
          {activeTab === 'stats' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <label style={labelStyle}>Key Statistics</label>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                    Stat names are templates — fill values any time.
                  </div>
                </div>
                <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, flexShrink: 0 }} onClick={addStat}>
                  <Plus size={12} style={{ display: 'inline', marginRight: 4 }} />Add
                </button>
              </div>

              {/* ── Icon-based Key Stats (top 5) ── */}
              {(() => {
                const keyStats = KEY_STATS_BY_ICON[icon] ?? KEY_STATS_BY_ICON['🏢'];
                return (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: '#8899b0', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
                      <span>
                        {ENTITY_ICONS.find((ic) => ic.value === icon)?.label ?? 'Company'} key stats
                        <span style={{ color: '#8899b0', marginLeft: 4 }}>— click to add · right-click to filter</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {keyStats.map((statName) => {
                        const alreadyAdded = statistics.some((s) => s.name === statName);
                        const isFiltered = activeStatFilter === statName;
                        const isHovered = hoveredKeyStat === statName;
                        return (
                          <div key={statName} style={{ position: 'relative' }}>
                            <button
                              onClick={() => { if (!alreadyAdded) setStatistics([...statistics, { id: uuidv4(), name: statName, value: '' }]); }}
                              onContextMenu={(e) => { e.preventDefault(); setActiveStatFilter(activeStatFilter === statName ? null : statName); }}
                              onMouseEnter={() => setHoveredKeyStat(statName)}
                              onMouseLeave={() => setHoveredKeyStat(null)}
                              style={{
                                background: isFiltered ? `${color}40` : alreadyAdded ? `${color}30` : `${color}15`,
                                border: `1px solid ${isFiltered ? color : alreadyAdded ? color : `${color}50`}`,
                                borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: isFiltered ? 700 : 600,
                                color: isFiltered ? color : alreadyAdded ? color : `${color}cc`,
                                cursor: alreadyAdded ? 'default' : 'pointer',
                                transition: 'all 0.1s',
                                opacity: alreadyAdded ? 0.7 : 1,
                                outline: isFiltered ? `2px solid ${color}60` : 'none',
                              }}
                            >
                              {alreadyAdded ? '✓ ' : '+ '}{statName}
                            </button>
                            {isHovered && STAT_DESCRIPTIONS[statName] && (
                              <div style={{
                                position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(8,15,30,0.97)',
                                border: `1px solid ${color}55`,
                                borderRadius: 10, padding: '9px 13px',
                                fontSize: 11.5, color: '#cbd5e1',
                                width: 210, lineHeight: 1.55,
                                zIndex: 9999, pointerEvents: 'none',
                                boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}22`,
                              }}>
                                <div style={{ fontWeight: 700, color: color, marginBottom: 4, fontSize: 12 }}>{statName}</div>
                                {STAT_DESCRIPTIONS[statName]}
                                {/* Arrow */}
                                <div style={{
                                  position: 'absolute', bottom: -5, left: '50%',
                                  width: 8, height: 8, background: 'rgba(8,15,30,0.97)',
                                  border: `1px solid ${color}55`, borderTop: 'none', borderLeft: 'none',
                                  transform: 'translateX(-50%) rotate(45deg)',
                                }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {statistics.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '8px 0 12px' }}>
                  <BarChart2 size={22} style={{ margin: '0 auto 6px', color: '#8899b0' }} />
                  Click a stat above to add it, or use Add for a custom one.
                </div>
              )}

              {/* ── Advanced Stats (collapsible) ── */}
              <div style={{ marginBottom: 14 }}>
                <button
                  onClick={() => setShowAdvancedStats((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: '1px solid rgba(59,130,246,0.2)',
                    borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
                    color: showAdvancedStats ? '#3b82f6' : '#94a3b8',
                    width: '100%', justifyContent: 'space-between',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <BarChart2 size={11} /> Advanced Stats
                    <span style={{ fontSize: 10, color: '#8899b0' }}>— all categories + custom</span>
                  </span>
                  <ChevronDown size={11} style={{ transform: showAdvancedStats ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>

                {showAdvancedStats && (
                  <div className="fade-in" style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: '#8899b0' }}>
                        Quick add:
                        {activeStatFilter === null
                          ? <span style={{ color: '#8899b0', marginLeft: 4 }}>(right-click to filter)</span>
                          : <span style={{ color: '#f59e0b', marginLeft: 4, cursor: 'pointer' }} onClick={() => setActiveStatFilter(null)}>
                              {activeStatFilter} · <span style={{ textDecoration: 'underline' }}>clear</span>
                            </span>
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                      {STAT_CATEGORIES.flatMap((c) => c.presets)
                        .filter((statName) => !(KEY_STATS_BY_ICON[icon] ?? KEY_STATS_BY_ICON['🏢']).includes(statName))
                        .map((statName) => {
                        const isActive = activeStatFilter === statName;
                        return (
                          <button
                            key={statName}
                            onClick={() => setStatistics([...statistics, { id: uuidv4(), name: statName, value: '' }])}
                            onContextMenu={(e) => { e.preventDefault(); setActiveStatFilter(activeStatFilter === statName ? null : statName); }}
                            style={{
                              background: isActive ? `${color}33` : `${color}1a`,
                              border: `1px solid ${isActive ? `${color}99` : `${color}40`}`,
                              borderRadius: 6, padding: '3px 8px', fontSize: 11,
                              color: isActive ? color : `${color}cc`,
                              cursor: 'pointer', transition: 'all 0.1s', fontWeight: isActive ? 600 : 400,
                            }}
                            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = `${color}30`; }}
                            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = `${color}1a`; }}
                          >
                            + {statName}
                          </button>
                        );
                      })}
                      {customStatPresets.map((preset) => {
                        const isActive = activeStatFilter === preset;
                        return (
                          <span key={preset} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <button
                              onClick={() => setStatistics([...statistics, { id: uuidv4(), name: preset, value: '' }])}
                              onContextMenu={(e) => { e.preventDefault(); setActiveStatFilter(activeStatFilter === preset ? null : preset); }}
                              style={{
                                background: isActive ? `${color}33` : `${color}1a`,
                                border: `1px solid ${isActive ? `${color}99` : `${color}40`}`,
                                borderRadius: '6px 0 0 6px', padding: '3px 8px', fontSize: 11,
                                color: isActive ? color : `${color}cc`, cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                              }}
                            >+ {preset}</button>
                            <button
                              onClick={() => removeCustomStatPreset(preset)}
                              title="Remove preset"
                              style={{
                                background: `${color}1a`, border: `1px solid ${color}40`,
                                borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '3px 5px',
                                fontSize: 10, color: '#8899b0', cursor: 'pointer',
                              }}
                            >×</button>
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <input
                        className="input-field"
                        value={newStatPreset}
                        onChange={(e) => setNewStatPreset(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newStatPreset.trim()) {
                            addCustomStatPreset(newStatPreset.trim());
                            setStatistics([...statistics, { id: uuidv4(), name: newStatPreset.trim(), value: '' }]);
                            setNewStatPreset('');
                          }
                        }}
                        placeholder="Save custom preset…"
                        style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                      />
                      <button
                        className="btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
                        disabled={!newStatPreset.trim()}
                        onClick={() => {
                          if (!newStatPreset.trim()) return;
                          addCustomStatPreset(newStatPreset.trim());
                          setStatistics([...statistics, { id: uuidv4(), name: newStatPreset.trim(), value: '' }]);
                          setNewStatPreset('');
                        }}
                      >
                        <Plus size={11} style={{ display: 'inline', marginRight: 3 }} />Save & Add
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {activeStatFilter !== null && statistics.filter(s => s.name === activeStatFilter).length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>
                  No &quot;{activeStatFilter}&quot; stat added yet.
                </div>
              )}

              {(activeStatFilter === null ? statistics : statistics.filter(s => s.name === activeStatFilter)).map((stat, i) => (
                <div key={stat.id} style={{
                  marginBottom: 8,
                  background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(59,130,246,0.15)',
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', width: 20, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                    <input
                      className="input-field"
                      value={stat.name}
                      onChange={(e) => updateStat(stat.id, 'name', e.target.value)}
                      placeholder="Stat name (e.g. Revenue)"
                      style={{ flex: 1 }}
                    />
                    <input
                      className="input-field"
                      value={stat.value}
                      onChange={(e) => updateStat(stat.id, 'value', e.target.value)}
                      placeholder="Value (e.g. $394B)"
                      style={{ flex: 1 }}
                    />
                    <button onClick={() => removeStat(stat.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 28 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>As of</span>
                    <input
                      type="date"
                      value={stat.asOf || ''}
                      onChange={(e) => updateStat(stat.id, 'asOf', e.target.value)}
                      style={{
                        flex: 1, fontSize: 11, padding: '3px 7px',
                        background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 6, color: '#94a3b8', outline: 'none',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(59,130,246,0.1)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!name.trim() || !icon}>
            {initialData?.id ? 'Save Changes' : 'Create Entity'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

function entity_color_or_default(c: string) { return c || '#3b82f6'; }
