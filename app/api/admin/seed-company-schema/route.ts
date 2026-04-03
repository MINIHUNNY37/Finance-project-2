import { NextRequest, NextResponse } from 'next/server';
import { auth, ADMIN_EMAILS } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  COMPANY_FACT_DEFINITIONS,
  COMPANY_LIBRARY_DEFINITIONS,
  COMPANY_METRIC_DEFINITIONS,
} from '@/lib/company-storage';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return null;
  }

  return session;
}

async function seedMetricDefinitions() {
  let seeded = 0;

  for (const definition of COMPANY_METRIC_DEFINITIONS) {
    await prisma.companyMetricDefinition.upsert({
      where: { code: definition.code },
      update: {
        label: definition.label,
        category: definition.category,
        unitType: definition.unitType,
        formula: definition.formula,
        description: definition.description,
        availableInPeriodTypes: definition.availableInPeriodTypes,
        sortOrder: definition.sortOrder,
      },
      create: {
        code: definition.code,
        label: definition.label,
        category: definition.category,
        unitType: definition.unitType,
        formula: definition.formula,
        description: definition.description,
        availableInPeriodTypes: definition.availableInPeriodTypes,
        sortOrder: definition.sortOrder,
      },
    });

    seeded += 1;
  }

  return { seeded, total: COMPANY_METRIC_DEFINITIONS.length };
}

async function seedFactDefinitions() {
  let seeded = 0;

  for (const definition of COMPANY_FACT_DEFINITIONS) {
    await prisma.companyFactDefinition.upsert({
      where: { code: definition.code },
      update: {
        label: definition.label,
        category: definition.category,
        unitType: definition.unitType,
        description: definition.description,
        sortOrder: definition.sortOrder,
      },
      create: {
        code: definition.code,
        label: definition.label,
        category: definition.category,
        unitType: definition.unitType,
        description: definition.description,
        sortOrder: definition.sortOrder,
      },
    });

    seeded += 1;
  }

  return { seeded, total: COMPANY_FACT_DEFINITIONS.length };
}

async function seedLibraries() {
  let seeded = 0;

  for (const library of COMPANY_LIBRARY_DEFINITIONS) {
    await prisma.companyLibrary.upsert({
      where: { slug: library.slug },
      update: {
        title: library.title,
        description: library.description,
        sortOrder: library.sortOrder,
        isActive: true,
      },
      create: {
        slug: library.slug,
        title: library.title,
        description: library.description,
        sortOrder: library.sortOrder,
      },
    });

    seeded += 1;
  }

  return { seeded, total: COMPANY_LIBRARY_DEFINITIONS.length };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [
    metricDefinitionCount,
    factDefinitionCount,
    libraryCount,
    companyCount,
    periodCount,
    metricValueCount,
    factValueCount,
    screeningSnapshotCount,
    ingestionRunCount,
    corporateActionCount,
  ] = await Promise.all([
    prisma.companyMetricDefinition.count(),
    prisma.companyFactDefinition.count(),
    prisma.companyLibrary.count(),
    prisma.company.count(),
    prisma.companyPeriod.count(),
    prisma.companyMetricValue.count(),
    prisma.companyFactValue.count(),
    prisma.companyScreeningSnapshot.count(),
    prisma.companyIngestionRun.count(),
    prisma.companyCorporateAction.count(),
  ]);

  return NextResponse.json({
    metricDefinitionCount,
    factDefinitionCount,
    libraryCount,
    companyCount,
    periodCount,
    metricValueCount,
    factValueCount,
    screeningSnapshotCount,
    ingestionRunCount,
    corporateActionCount,
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const step = searchParams.get('step') ?? 'all';

  if (step === '1') {
    return NextResponse.json({ ok: true, step: 1, ...(await seedMetricDefinitions()) });
  }

  if (step === '2') {
    return NextResponse.json({ ok: true, step: 2, ...(await seedLibraries()) });
  }

  if (step === 'facts') {
    return NextResponse.json({ ok: true, step: 'facts', ...(await seedFactDefinitions()) });
  }

  if (step === 'all') {
    const [metrics, facts, libraries] = await Promise.all([
      seedMetricDefinitions(),
      seedFactDefinitions(),
      seedLibraries(),
    ]);

    return NextResponse.json({
      ok: true,
      step: 'all',
      metrics,
      facts,
      libraries,
    });
  }

  return NextResponse.json(
    { error: 'step must be 1, 2, facts, or all' },
    { status: 400 },
  );
}
