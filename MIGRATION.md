# Customer Database Migration

## What this migration does

Creates three new tables for the customer database feature:

- **`customers`** — Stores customer records (name, email, phone, address, notes) per user
- **`customer_fields`** — User-defined custom field definitions (label + type)
- **`customer_field_values`** — Values for each custom field per customer

All tables have Row Level Security (RLS) enabled so users can only access their own data.

## How to apply

### Option 1: Supabase Dashboard (recommended)

1. Go to [https://supabase.com/dashboard/project/stigtkowvpjkjejxpsda](https://supabase.com/dashboard/project/stigtkowvpjkjejxpsda)
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**
4. Paste the contents of `supabase/migrations/20260607_customers.sql`
5. Click **Run**

### Option 2: Supabase CLI (if configured)

```bash
supabase db push
```

## Migration file

`supabase/migrations/20260607_customers.sql`

## Tables created

### `public.customers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key, auto-generated |
| user_id | uuid | FK → auth.users, cascade delete |
| name | text | Required |
| email | text | Optional |
| phone | text | Optional |
| address | text | Optional |
| notes | text | Optional |
| created_at | timestamptz | Auto-set |

### `public.customer_fields`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK → auth.users |
| label | text | Display name |
| field_type | text | text / number / date / boolean |
| created_at | timestamptz | Auto-set |

### `public.customer_field_values`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| customer_id | uuid | FK → customers, cascade delete |
| field_id | uuid | FK → customer_fields, cascade delete |
| value | text | Stored as text regardless of type |
