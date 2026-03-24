export interface IBillingCheck {
  checkPlanLimit(
    orgId: string,
    resource: string,
  ): Promise<{ used: number; limit: number; upgradePlan: string } | null>;
  countResource?(orgId: string, resource: string): Promise<number>;
}
