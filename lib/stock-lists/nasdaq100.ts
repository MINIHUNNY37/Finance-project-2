export interface StockEntry {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
}

/** NASDAQ-100 constituents (2025 snapshot) */
export const NASDAQ100: StockEntry[] = [
  // Technology
  { ticker: 'AAPL',  name: 'Apple Inc.',                       sector: 'Technology',              industry: 'Consumer Electronics',            exchange: 'NASDAQ' },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',                  sector: 'Technology',              industry: 'Software—Infrastructure',         exchange: 'NASDAQ' },
  { ticker: 'NVDA',  name: 'NVIDIA Corp.',                     sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'AVGO',  name: 'Broadcom Inc.',                    sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'AMD',   name: 'Advanced Micro Devices',           sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'ADBE',  name: 'Adobe Inc.',                       sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'QCOM',  name: 'Qualcomm Inc.',                    sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'CSCO',  name: 'Cisco Systems Inc.',               sector: 'Technology',              industry: 'Communication Equipment',         exchange: 'NASDAQ' },
  { ticker: 'INTC',  name: 'Intel Corp.',                      sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'INTU',  name: 'Intuit Inc.',                      sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'AMAT',  name: 'Applied Materials Inc.',           sector: 'Technology',              industry: 'Semiconductor Equipment',         exchange: 'NASDAQ' },
  { ticker: 'LRCX',  name: 'Lam Research Corp.',               sector: 'Technology',              industry: 'Semiconductor Equipment',         exchange: 'NASDAQ' },
  { ticker: 'MU',    name: 'Micron Technology Inc.',           sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'SNPS',  name: 'Synopsys Inc.',                    sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'KLAC',  name: 'KLA Corp.',                        sector: 'Technology',              industry: 'Semiconductor Equipment',         exchange: 'NASDAQ' },
  { ticker: 'CDNS',  name: 'Cadence Design Systems Inc.',      sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'ADI',   name: 'Analog Devices Inc.',              sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'MCHP',  name: 'Microchip Technology Inc.',        sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'NXPI',  name: 'NXP Semiconductors N.V.',          sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'ON',    name: 'ON Semiconductor Corp.',           sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  { ticker: 'PANW',  name: 'Palo Alto Networks Inc.',          sector: 'Technology',              industry: 'Software—Infrastructure',         exchange: 'NASDAQ' },
  { ticker: 'CRWD',  name: 'CrowdStrike Holdings Inc.',        sector: 'Technology',              industry: 'Software—Infrastructure',         exchange: 'NASDAQ' },
  { ticker: 'FTNT',  name: 'Fortinet Inc.',                    sector: 'Technology',              industry: 'Software—Infrastructure',         exchange: 'NASDAQ' },
  { ticker: 'ZS',    name: 'Zscaler Inc.',                     sector: 'Technology',              industry: 'Software—Infrastructure',         exchange: 'NASDAQ' },
  { ticker: 'DDOG',  name: 'Datadog Inc.',                     sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'ANSS',  name: 'ANSYS Inc.',                       sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'TEAM',  name: 'Atlassian Corp.',                  sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'CDW',   name: 'CDW Corp.',                        sector: 'Technology',              industry: 'Electronic Components',           exchange: 'NASDAQ' },
  { ticker: 'GFS',   name: 'GlobalFoundries Inc.',             sector: 'Technology',              industry: 'Semiconductors',                  exchange: 'NASDAQ' },
  // Communication Services
  { ticker: 'META',  name: 'Meta Platforms Inc.',              sector: 'Communication Services',  industry: 'Internet Content & Information',  exchange: 'NASDAQ' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. Class A',            sector: 'Communication Services',  industry: 'Internet Content & Information',  exchange: 'NASDAQ' },
  { ticker: 'GOOG',  name: 'Alphabet Inc. Class C',            sector: 'Communication Services',  industry: 'Internet Content & Information',  exchange: 'NASDAQ' },
  { ticker: 'NFLX',  name: 'Netflix Inc.',                     sector: 'Communication Services',  industry: 'Entertainment',                   exchange: 'NASDAQ' },
  { ticker: 'CHTR',  name: 'Charter Communications Inc.',      sector: 'Communication Services',  industry: 'Telecom Services',                exchange: 'NASDAQ' },
  { ticker: 'TMUS',  name: 'T-Mobile US Inc.',                 sector: 'Communication Services',  industry: 'Telecom Services',                exchange: 'NASDAQ' },
  { ticker: 'WBD',   name: 'Warner Bros. Discovery Inc.',      sector: 'Communication Services',  industry: 'Entertainment',                   exchange: 'NASDAQ' },
  { ticker: 'FOXA',  name: 'Fox Corp. Class A',                sector: 'Communication Services',  industry: 'Entertainment',                   exchange: 'NASDAQ' },
  { ticker: 'FOX',   name: 'Fox Corp. Class B',                sector: 'Communication Services',  industry: 'Entertainment',                   exchange: 'NASDAQ' },
  { ticker: 'EA',    name: 'Electronic Arts Inc.',             sector: 'Communication Services',  industry: 'Electronic Gaming & Multimedia',  exchange: 'NASDAQ' },
  { ticker: 'TTWO',  name: 'Take-Two Interactive Software',    sector: 'Communication Services',  industry: 'Electronic Gaming & Multimedia',  exchange: 'NASDAQ' },
  // Consumer Discretionary
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',                  sector: 'Consumer Discretionary',  industry: 'Internet Retail',                 exchange: 'NASDAQ' },
  { ticker: 'TSLA',  name: 'Tesla Inc.',                       sector: 'Consumer Discretionary',  industry: 'Auto Manufacturers',              exchange: 'NASDAQ' },
  { ticker: 'COST',  name: 'Costco Wholesale Corp.',           sector: 'Consumer Staples',        industry: 'Discount Stores',                 exchange: 'NASDAQ' },
  { ticker: 'SBUX',  name: 'Starbucks Corp.',                  sector: 'Consumer Discretionary',  industry: 'Restaurants',                     exchange: 'NASDAQ' },
  { ticker: 'MELI',  name: 'MercadoLibre Inc.',                sector: 'Consumer Discretionary',  industry: 'Internet Retail',                 exchange: 'NASDAQ' },
  { ticker: 'ORLY',  name: "O'Reilly Automotive Inc.",         sector: 'Consumer Discretionary',  industry: 'Specialty Retail',                exchange: 'NASDAQ' },
  { ticker: 'ROST',  name: 'Ross Stores Inc.',                 sector: 'Consumer Discretionary',  industry: 'Apparel Retail',                  exchange: 'NASDAQ' },
  { ticker: 'BKNG',  name: 'Booking Holdings Inc.',            sector: 'Consumer Discretionary',  industry: 'Travel Services',                 exchange: 'NASDAQ' },
  { ticker: 'EBAY',  name: 'eBay Inc.',                        sector: 'Consumer Discretionary',  industry: 'Internet Retail',                 exchange: 'NASDAQ' },
  { ticker: 'ABNB',  name: 'Airbnb Inc.',                      sector: 'Consumer Discretionary',  industry: 'Travel Services',                 exchange: 'NASDAQ' },
  { ticker: 'MAR',   name: 'Marriott International Inc.',      sector: 'Consumer Discretionary',  industry: 'Lodging',                         exchange: 'NASDAQ' },
  { ticker: 'DLTR',  name: 'Dollar Tree Inc.',                 sector: 'Consumer Discretionary',  industry: 'Discount Stores',                 exchange: 'NASDAQ' },
  { ticker: 'ALGN',  name: 'Align Technology Inc.',            sector: 'Healthcare',              industry: 'Medical Devices',                 exchange: 'NASDAQ' },
  // Consumer Staples
  { ticker: 'PEP',   name: 'PepsiCo Inc.',                     sector: 'Consumer Staples',        industry: 'Beverages—Non-Alcoholic',          exchange: 'NASDAQ' },
  { ticker: 'MDLZ',  name: 'Mondelez International Inc.',      sector: 'Consumer Staples',        industry: 'Confectioners',                   exchange: 'NASDAQ' },
  { ticker: 'KDP',   name: 'Keurig Dr Pepper Inc.',            sector: 'Consumer Staples',        industry: 'Beverages—Non-Alcoholic',          exchange: 'NASDAQ' },
  { ticker: 'MNST',  name: 'Monster Beverage Corp.',           sector: 'Consumer Staples',        industry: 'Beverages—Non-Alcoholic',          exchange: 'NASDAQ' },
  { ticker: 'WBA',   name: 'Walgreens Boots Alliance Inc.',    sector: 'Consumer Staples',        industry: 'Pharmaceutical Retailers',        exchange: 'NASDAQ' },
  // Healthcare
  { ticker: 'AMGN',  name: 'Amgen Inc.',                       sector: 'Healthcare',              industry: 'Drug Manufacturers',              exchange: 'NASDAQ' },
  { ticker: 'ISRG',  name: 'Intuitive Surgical Inc.',          sector: 'Healthcare',              industry: 'Medical Devices',                 exchange: 'NASDAQ' },
  { ticker: 'VRTX',  name: 'Vertex Pharmaceuticals Inc.',      sector: 'Healthcare',              industry: 'Biotechnology',                   exchange: 'NASDAQ' },
  { ticker: 'REGN',  name: 'Regeneron Pharmaceuticals Inc.',   sector: 'Healthcare',              industry: 'Biotechnology',                   exchange: 'NASDAQ' },
  { ticker: 'BIIB',  name: 'Biogen Inc.',                      sector: 'Healthcare',              industry: 'Biotechnology',                   exchange: 'NASDAQ' },
  { ticker: 'IDXX',  name: 'IDEXX Laboratories Inc.',          sector: 'Healthcare',              industry: 'Diagnostics & Research',          exchange: 'NASDAQ' },
  { ticker: 'DXCM',  name: 'DexCom Inc.',                      sector: 'Healthcare',              industry: 'Medical Devices',                 exchange: 'NASDAQ' },
  { ticker: 'ILMN',  name: 'Illumina Inc.',                    sector: 'Healthcare',              industry: 'Diagnostics & Research',          exchange: 'NASDAQ' },
  { ticker: 'MRNA',  name: 'Moderna Inc.',                     sector: 'Healthcare',              industry: 'Biotechnology',                   exchange: 'NASDAQ' },
  { ticker: 'GEHC',  name: 'GE HealthCare Technologies Inc.',  sector: 'Healthcare',              industry: 'Medical Devices',                 exchange: 'NASDAQ' },
  // Industrials
  { ticker: 'HON',   name: 'Honeywell International Inc.',     sector: 'Industrials',             industry: 'Diversified Industrials',         exchange: 'NASDAQ' },
  { ticker: 'CTAS',  name: 'Cintas Corp.',                     sector: 'Industrials',             industry: 'Specialty Business Services',     exchange: 'NASDAQ' },
  { ticker: 'PAYX',  name: 'Paychex Inc.',                     sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'PCAR',  name: 'PACCAR Inc.',                      sector: 'Industrials',             industry: 'Farm & Heavy Construction Machinery', exchange: 'NASDAQ' },
  { ticker: 'FAST',  name: 'Fastenal Co.',                     sector: 'Industrials',             industry: 'Industrial Distribution',         exchange: 'NASDAQ' },
  { ticker: 'ODFL',  name: 'Old Dominion Freight Line Inc.',   sector: 'Industrials',             industry: 'Trucking',                        exchange: 'NASDAQ' },
  { ticker: 'CPRT',  name: 'Copart Inc.',                      sector: 'Industrials',             industry: 'Specialty Retail',                exchange: 'NASDAQ' },
  { ticker: 'VRSK',  name: 'Verisk Analytics Inc.',            sector: 'Industrials',             industry: 'Consulting Services',             exchange: 'NASDAQ' },
  // Financials
  { ticker: 'PYPL',  name: 'PayPal Holdings Inc.',             sector: 'Financials',              industry: 'Credit Services',                 exchange: 'NASDAQ' },
  // Energy
  { ticker: 'BKR',   name: 'Baker Hughes Co.',                 sector: 'Energy',                  industry: 'Oil & Gas Equipment & Services',  exchange: 'NASDAQ' },
  { ticker: 'FANG',  name: 'Diamondback Energy Inc.',          sector: 'Energy',                  industry: 'Oil & Gas E&P',                   exchange: 'NASDAQ' },
  // Utilities
  { ticker: 'EXC',   name: 'Exelon Corp.',                     sector: 'Utilities',               industry: 'Utilities—Regulated Electric',    exchange: 'NASDAQ' },
  { ticker: 'XEL',   name: 'Xcel Energy Inc.',                 sector: 'Utilities',               industry: 'Utilities—Regulated Electric',    exchange: 'NASDAQ' },
  { ticker: 'AEP',   name: 'American Electric Power Co.',      sector: 'Utilities',               industry: 'Utilities—Regulated Electric',    exchange: 'NASDAQ' },
  // Additional Technology (ADP, WDAY)
  { ticker: 'ADP',   name: 'Automatic Data Processing Inc.',   sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'WDAY',  name: 'Workday Inc.',                     sector: 'Technology',              industry: 'Software—Application',            exchange: 'NASDAQ' },
  { ticker: 'CTSH',  name: 'Cognizant Technology Solutions',   sector: 'Technology',              industry: 'Information Technology Services', exchange: 'NASDAQ' },
  { ticker: 'ASML',  name: 'ASML Holding N.V.',                sector: 'Technology',              industry: 'Semiconductor Equipment',         exchange: 'NASDAQ' },
];
