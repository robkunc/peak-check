# Development Scripts

This directory contains helper scripts for development and testing.

## Seed Sample Data

To populate your development database with sample peaks:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-sample-data.ts
```

This will create:
- 6 sample peaks from Southern California mountains
- Sample data sources for some peaks

**Note**: You'll need `ts-node` installed:
```bash
npm install -D ts-node
```

## Creating Your First Admin User

After you've signed in once via the auth flow:

1. Open Prisma Studio:
   ```bash
   npx prisma studio
   ```

2. Navigate to the `users` table

3. Find your user and change the `role` field from `LEADER` to `ADMIN`

4. Save the changes

You'll now have admin access to the application!


