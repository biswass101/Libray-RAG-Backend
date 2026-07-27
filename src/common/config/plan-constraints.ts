export interface PlanConstraints {
  maxBorrows: number;
  borrowDurationDays: number;
  maxRenewals: number;
  renewalExtensionDays: number;
  finePerDay: number;
  maxReservations: number;
  membershipFee: number;
  renewalFee: number;
  gracePeriodDays: number;
}

export type PlanType = 'standard' | 'premium' | 'student';

export const PLAN_CONSTRAINTS: Record<PlanType, PlanConstraints> = {
  premium: {
    maxBorrows: 10,
    borrowDurationDays: 30,
    maxRenewals: 4,
    renewalExtensionDays: 21,
    finePerDay: 0.25,
    maxReservations: 5,
    membershipFee: 100,
    renewalFee: 80,
    gracePeriodDays: 7,
  },
  standard: {
    maxBorrows: 5,
    borrowDurationDays: 14,
    maxRenewals: 2,
    renewalExtensionDays: 14,
    finePerDay: 0.50,
    maxReservations: 3,
    membershipFee: 50,
    renewalFee: 40,
    gracePeriodDays: 3,
  },
  student: {
    maxBorrows: 3,
    borrowDurationDays: 21,
    maxRenewals: 1,
    renewalExtensionDays: 7,
    finePerDay: 0.25,
    maxReservations: 2,
    membershipFee: 20,
    renewalFee: 15,
    gracePeriodDays: 5,
  },
};

export function getPlanConstraints(plan: string): PlanConstraints {
  return PLAN_CONSTRAINTS[plan as PlanType] ?? PLAN_CONSTRAINTS.standard;
}
