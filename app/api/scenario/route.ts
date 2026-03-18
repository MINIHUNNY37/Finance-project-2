import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs'; // needs Node for Anthropic SDK

export interface ScenarioEntity {
  id: string;
  name: string;
  ticker?: string;
  sector?: string;
  thesis?: string;
  tags?: string[];
  livePrice?: number;
  targetPrice?: number;
}

export interface ScenarioRelationship {
  fromId: string;
  toId: string;
  label: string;
  description?: string;
}

export interface EntityImpact {
  entityId: string;
  impact: 'positive' | 'negative' | 'neutral' | 'unknown';
  magnitude: 'high' | 'medium' | 'low';
  reasoning: string;
  keyRisk?: string;
}

export interface ScenarioResult {
  summary: string;
  impacts: EntityImpact[];
}

export async function POST(req: NextRequest) {
  try {
    const { shock, sourceEntityId, entities, relationships } = await req.json() as {
      shock: string;
      sourceEntityId: string;
      entities: ScenarioEntity[];
      relationships: ScenarioRelationship[];
    };

    if (!shock || !sourceEntityId || !entities?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
    }

    const client = new Anthropic({ apiKey });

    const sourceEntity = entities.find((e) => e.id === sourceEntityId);
    if (!sourceEntity) {
      return NextResponse.json({ error: 'Source entity not found' }, { status: 400 });
    }

    // Build a compact graph description
    const entityMap = Object.fromEntries(entities.map((e) => [e.id, e]));
    const graphLines: string[] = entities.map((e) => {
      const parts: string[] = [`- ${e.name}${e.ticker ? ` ($${e.ticker})` : ''}${e.sector ? ` [${e.sector}]` : ''}`];
      if (e.thesis) parts.push(`  Thesis: ${e.thesis}`);
      return parts.join('\n');
    });

    const relLines: string[] = relationships.map((r) => {
      const from = entityMap[r.fromId]?.name ?? r.fromId;
      const to = entityMap[r.toId]?.name ?? r.toId;
      return `- ${from} → ${to}${r.label ? ` (${r.label})` : ''}${r.description ? `: ${r.description}` : ''}`;
    });

    const prompt = `You are an investment analyst. Analyze how the following macroeconomic or company-level shock propagates through an investor's portfolio map.

**SHOCK / SCENARIO:**
"${shock}"

**SOURCE ENTITY (where the shock originates):**
${sourceEntity.name}${sourceEntity.ticker ? ` ($${sourceEntity.ticker})` : ''}${sourceEntity.sector ? ` [${sourceEntity.sector}]` : ''}

**ALL ENTITIES IN THE MAP:**
${graphLines.join('\n')}

**RELATIONSHIPS (connections between entities):**
${relLines.length > 0 ? relLines.join('\n') : '(no explicit connections)'}

**YOUR TASK:**
For EACH entity in the map, assess how the shock propagates to it (directly or through connected entities). Return a JSON object with this exact structure:

{
  "summary": "1-2 sentence plain-English summary of the scenario's overall effect on this portfolio",
  "impacts": [
    {
      "entityId": "<id from the list below>",
      "impact": "positive" | "negative" | "neutral" | "unknown",
      "magnitude": "high" | "medium" | "low",
      "reasoning": "1 sentence explaining why",
      "keyRisk": "optional 1 sentence describing the main risk or opportunity to watch"
    }
  ]
}

Entity IDs (use these exactly):
${entities.map((e) => `${e.id} = ${e.name}`).join('\n')}

Respond with ONLY the JSON object, no markdown, no extra text.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';

    // Parse JSON, stripping any accidental markdown fences
    const jsonStr = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const result: ScenarioResult = JSON.parse(jsonStr);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Scenario propagation error:', err);
    return NextResponse.json({ error: 'Failed to generate scenario analysis' }, { status: 500 });
  }
}
