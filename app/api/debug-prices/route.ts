import { NextResponse } from "next/server";

const VARS: Record<string, string | undefined> = {
  STRIPE_INVOICING_PRICE_ID: process.env.STRIPE_INVOICING_PRICE_ID,
  STRIPE_ESTIMATES_PRICE_ID: process.env.STRIPE_ESTIMATES_PRICE_ID,
  STRIPE_TIME_TRACKING_PRICE_ID: process.env.STRIPE_TIME_TRACKING_PRICE_ID,
  STRIPE_ACCOUNTS_PAYABLE_PRICE_ID: process.env.STRIPE_ACCOUNTS_PAYABLE_PRICE_ID,
  STRIPE_RECURRING_PRICE_ID: process.env.STRIPE_RECURRING_PRICE_ID,
  STRIPE_SCHEDULING_PRICE_ID: process.env.STRIPE_SCHEDULING_PRICE_ID,
  STRIPE_PROJECTS_PRICE_ID: process.env.STRIPE_PROJECTS_PRICE_ID,
  STRIPE_TAX_PRICE_ID: process.env.STRIPE_TAX_PRICE_ID,
  STRIPE_INVENTORY_PRICE_ID: process.env.STRIPE_INVENTORY_PRICE_ID,
  STRIPE_TEAM_PRICE_ID: process.env.STRIPE_TEAM_PRICE_ID,
  STRIPE_MILEAGE_PRICE_ID: process.env.STRIPE_MILEAGE_PRICE_ID,
  STRIPE_BUDGETING_PRICE_ID: process.env.STRIPE_BUDGETING_PRICE_ID,
  STRIPE_PURCHASE_ORDERS_PRICE_ID: process.env.STRIPE_PURCHASE_ORDERS_PRICE_ID,
};

export async function GET() {
  const results = Object.entries(VARS).map(([name, val]) => ({
    name,
    status: !val ? "MISSING" : val.startsWith("price_") ? "OK" : `BAD (starts with: ${val.slice(0, 5)})`,
  }));
  return NextResponse.json(results);
}
