import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

function parseOptionalNumber(value: string | null) {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const library = searchParams.get('library')?.trim().toLowerCase() ?? 'all';
  const perMax = parseOptionalNumber(searchParams.get('perMax'));
  const roicMin = parseOptionalNumber(searchParams.get('roicMin'));
  const netDebtEbitdaMax = parseOptionalNumber(searchParams.get('netDebtEbitdaMax'));
  const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  const companyWhere: Prisma.CompanyWhereInput = {
    isActive: true,
  };

  if (search) {
    companyWhere.OR = [
      { ticker: { contains: search.toUpperCase() } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (library !== 'all') {
    companyWhere.memberships = {
      some: {
        library: {
          slug: library,
        },
      },
    };
  }

  const where: Prisma.CompanyScreeningSnapshotWhereInput = {
    snapshotType: 'latest',
    company: companyWhere,
  };

  if (perMax != null) {
    where.per = { lte: perMax };
  }

  if (roicMin != null) {
    where.roic = { gte: roicMin };
  }

  if (netDebtEbitdaMax != null) {
    where.netDebtEbitda = { lte: netDebtEbitdaMax };
  }

  const [snapshots, total] = await Promise.all([
    prisma.companyScreeningSnapshot.findMany({
      where,
      include: {
        company: {
          include: {
            memberships: {
              include: {
                library: {
                  select: {
                    slug: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        company: {
          ticker: 'asc',
        },
      },
      skip: offset,
      take: limit,
    }),
    prisma.companyScreeningSnapshot.count({ where }),
  ]);

  return NextResponse.json({
    companies: snapshots.map((snapshot) => ({
      ticker: snapshot.company.ticker,
      name: snapshot.company.name,
      exchange: snapshot.company.exchange,
      sector: snapshot.company.sector,
      industry: snapshot.company.industry,
      country: snapshot.company.country,
      libraries: snapshot.company.memberships.map((membership) => ({
        slug: membership.library.slug,
        title: membership.library.title,
      })),
      asOfDate: snapshot.asOfDate.toISOString().split('T')[0],
      priceDate: snapshot.priceDate?.toISOString().split('T')[0] ?? null,
      metrics: {
        per: snapshot.per,
        pbr: snapshot.pbr,
        evEbit: snapshot.evEbit,
        fcfYield: snapshot.fcfYield,
        valuationPercentile: snapshot.valuationPercentile,
        revenueGrowth: snapshot.revenueGrowth,
        operatingMargin: snapshot.operatingMargin,
        roe: snapshot.roe,
        roic: snapshot.roic,
        cfoNetIncomeRatio: snapshot.cfoNetIncomeRatio,
        fcf: snapshot.fcf,
        netDebtEbitda: snapshot.netDebtEbitda,
        interestCoverage: snapshot.interestCoverage,
        cashShortTermDebtRatio: snapshot.cashShortTermDebtRatio,
        shareholderYield: snapshot.shareholderYield,
      },
    })),
    total,
    offset,
    limit,
  });
}
