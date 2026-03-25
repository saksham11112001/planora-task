export const PLAN_LIMITS = {
  free:     { members: 5,  projects: 3,  storage_gb: 1,  features: ['tasks','projects','clients','time_tracking','recurring'] },
  starter:  { members: 15, projects: 15, storage_gb: 10, features: ['tasks','projects','clients','time_tracking','recurring'] },
  pro:      { members: 50, projects: 100,storage_gb: 50, features: ['tasks','projects','clients','time_tracking','recurring','reports','api'] },
  business: { members: -1, projects: -1, storage_gb: 200,features: ['tasks','projects','clients','time_tracking','recurring','reports','api','sso','audit'] },
}

export const RAZORPAY_PLANS: Record<string, { name: string; priceINR: number; priceUSD: number; planId: string }> = {
  starter:  { name: 'Starter',  priceINR: 999,  priceUSD: 12, planId: process.env.RAZORPAY_STARTER_PLAN_ID  ?? '' },
  pro:      { name: 'Pro',      priceINR: 2999, priceUSD: 36, planId: process.env.RAZORPAY_PRO_PLAN_ID      ?? '' },
  business: { name: 'Business', priceINR: 7999, priceUSD: 96, planId: process.env.RAZORPAY_BUSINESS_PLAN_ID ?? '' },
}

export function canUseFeature(plan: string, feature: string) {
  return (PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]?.features ?? []).includes(feature)
}
