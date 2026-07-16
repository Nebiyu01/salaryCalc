import { z } from "zod";

/**
 * Retirement projection engine — pure, framework-agnostic, deterministic.
 *
 * Given a set of assumptions it simulates 401(k) + Roth IRA growth year by
 * year until retirement. Kept free of React/DOM so it can be unit-tested and
 * reused on the backend (reports, analytics) as well as in the UI.
 */

// 2025 IRS base contribution limits and catch-up amounts (age 50+).
// Limits are indexed to inflation across the projection.
export const RETIREMENT_LIMITS = {
  base401k: 23500,
  baseRoth: 7500,
  catchUp401k: 7500,
  catchUpRoth: 1000,
  catchUpAge: 50,
};

export const retirementAssumptionsSchema = z
  .object({
    currentAge: z.number().int().min(16).max(90).default(30),
    retirementAge: z.number().int().min(17).max(100).default(65),

    current401kBalance: z.number().min(0).default(0),
    currentRothBalance: z.number().min(0).default(0),

    annualReturnPct: z.number().min(0).max(30).default(7),
    inflationPct: z.number().min(0).max(20).default(2.5),

    salary: z.number().min(0).default(0),
    salaryGrowthPct: z.number().min(0).max(20).default(2),

    annual401kContribution: z.number().min(0).default(0),
    annualRothContribution: z.number().min(0).default(0),

    // Employer match: `rate`% of your contribution, up to `limit`% of salary.
    employerMatchRatePct: z.number().min(0).max(200).default(100),
    employerMatchLimitPct: z.number().min(0).max(100).default(6),

    catchUpEnabled: z.boolean().default(true),
    escalateContributions: z.boolean().default(false),

    withdrawalRatePct: z.number().min(1).max(10).default(4),
  })
  .refine((a) => a.retirementAge > a.currentAge, {
    message: "Retirement age must be greater than current age",
    path: ["retirementAge"],
  });

export type RetirementAssumptions = z.infer<typeof retirementAssumptionsSchema>;

export interface ProjectionYear {
  age: number;
  yearIndex: number; // 0 = today (starting balances)
  k401Balance: number;
  rothBalance: number;
  totalBalance: number; // nominal
  realTotalBalance: number; // today's dollars
  contributions: number; // employee only, this year
  employerMatch: number; // this year
  gains: number; // investment growth this year
  cumulativeContributions: number;
  cumulativeEmployerMatch: number;
  cumulativeGains: number;
}

export interface ProjectionSummary {
  yearsToRetirement: number;
  finalBalance: number; // nominal
  finalRealBalance: number; // today's dollars
  startingBalance: number;
  totalContributions: number;
  totalEmployerMatch: number;
  totalGains: number;
  annualRetirementIncome: number; // nominal, withdrawalRate% of final
  annualRetirementIncomeReal: number; // today's dollars
}

export interface ProjectionResult {
  years: ProjectionYear[];
  summary: ProjectionSummary;
}

function pow(base: number, exp: number): number {
  return Math.pow(base, exp);
}

/**
 * Run the projection. Contributions use a half-year growth convention (they
 * arrive throughout the year, not as a lump sum on Jan 1), which is a small
 * but meaningful accuracy improvement over compounding a full year.
 */
export function projectRetirement(
  assumptions: RetirementAssumptions,
): ProjectionResult {
  const a = assumptions;
  const r = a.annualReturnPct / 100;
  const infl = a.inflationPct / 100;
  const salaryGrowth = a.salaryGrowthPct / 100;
  const matchRate = a.employerMatchRatePct / 100;
  const matchLimit = a.employerMatchLimitPct / 100;
  const n = Math.max(0, a.retirementAge - a.currentAge);

  const years: ProjectionYear[] = [];

  let k401 = a.current401kBalance;
  let roth = a.currentRothBalance;
  const startingBalance = k401 + roth;

  let cumulativeContributions = 0;
  let cumulativeEmployerMatch = 0;
  let cumulativeGains = 0;

  // Year 0: today's starting balances.
  years.push({
    age: a.currentAge,
    yearIndex: 0,
    k401Balance: k401,
    rothBalance: roth,
    totalBalance: k401 + roth,
    realTotalBalance: k401 + roth,
    contributions: 0,
    employerMatch: 0,
    gains: 0,
    cumulativeContributions: 0,
    cumulativeEmployerMatch: 0,
    cumulativeGains: 0,
  });

  for (let t = 1; t <= n; t++) {
    const yearsElapsed = t - 1; // beginning-of-year offset
    const inflationIndex = pow(1 + infl, yearsElapsed);
    const isCatchUp = a.catchUpEnabled && a.currentAge + yearsElapsed >= RETIREMENT_LIMITS.catchUpAge;

    // Inflation-indexed contribution limits for this year.
    const limit401k =
      (RETIREMENT_LIMITS.base401k + (isCatchUp ? RETIREMENT_LIMITS.catchUp401k : 0)) *
      inflationIndex;
    const limitRoth =
      (RETIREMENT_LIMITS.baseRoth + (isCatchUp ? RETIREMENT_LIMITS.catchUpRoth : 0)) *
      inflationIndex;

    const salaryThisYear = a.salary * pow(1 + salaryGrowth, yearsElapsed);
    const escalation = a.escalateContributions ? pow(1 + salaryGrowth, yearsElapsed) : 1;

    const contrib401k = Math.min(a.annual401kContribution * escalation, limit401k);
    const contribRoth = Math.min(a.annualRothContribution * escalation, limitRoth);

    // Employer matches matchRate on contributions up to matchLimit% of salary.
    const matchableContribution = Math.min(contrib401k, salaryThisYear * matchLimit);
    const employerMatch = matchableContribution * matchRate;

    const invested401k = contrib401k + employerMatch;

    const k401Start = k401;
    const rothStart = roth;

    // Grow existing balance a full year; new contributions half a year.
    k401 = k401Start * (1 + r) + invested401k * (1 + r / 2);
    roth = rothStart * (1 + r) + contribRoth * (1 + r / 2);

    const contributions = contrib401k + contribRoth;
    const gains =
      k401 - k401Start - invested401k + (roth - rothStart - contribRoth);

    cumulativeContributions += contributions;
    cumulativeEmployerMatch += employerMatch;
    cumulativeGains += gains;

    const totalBalance = k401 + roth;
    const realDeflator = pow(1 + infl, t);

    years.push({
      age: a.currentAge + t,
      yearIndex: t,
      k401Balance: k401,
      rothBalance: roth,
      totalBalance,
      realTotalBalance: totalBalance / realDeflator,
      contributions,
      employerMatch,
      gains,
      cumulativeContributions,
      cumulativeEmployerMatch,
      cumulativeGains,
    });
  }

  const last = years[years.length - 1];
  const withdrawal = a.withdrawalRatePct / 100;

  const summary: ProjectionSummary = {
    yearsToRetirement: n,
    finalBalance: last.totalBalance,
    finalRealBalance: last.realTotalBalance,
    startingBalance,
    totalContributions: cumulativeContributions,
    totalEmployerMatch: cumulativeEmployerMatch,
    totalGains: cumulativeGains,
    annualRetirementIncome: last.totalBalance * withdrawal,
    annualRetirementIncomeReal: last.realTotalBalance * withdrawal,
  };

  return { years, summary };
}
