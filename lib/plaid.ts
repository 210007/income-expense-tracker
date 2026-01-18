import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

if (!process.env.PLAID_CLIENT_ID) throw new Error("Missing PLAID_CLIENT_ID");
if (!process.env.PLAID_SECRET) throw new Error("Missing PLAID_SECRET");

const configuration = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
