const fs = require('fs');
const path = '.env.local';

try {
    let content = fs.readFileSync(path, 'utf8');
    console.log('Original content length:', content.length);

    // Split into lines
    let lines = content.split(/\r?\n/);

    // Filter out existing DB variables to avoid duplicates
    lines = lines.filter(line =>
        !line.startsWith('DATABASE_URL=') &&
        !line.startsWith('DIRECT_URL=') &&
        !line.startsWith('POSTGRES_PRISMA_URL=') &&
        !line.startsWith('POSTGRES_URL_NON_POOLING=')
    );

    // Append correct values
    const newLines = [
        ...lines,
        'DATABASE_URL="postgres://postgres.hucfrbhxbkoufycinrhx:6do3UjQ4xTXfeJbP@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"',
        'DIRECT_URL="postgres://postgres.hucfrbhxbkoufycinrhx:6do3UjQ4xTXfeJbP@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"'
    ];

    // Join and write back
    fs.writeFileSync(path, newLines.join('\n'));
    console.log('Successfully updated .env.local');

} catch (err) {
    console.error('Error updating .env.local:', err);
    process.exit(1);
}
