/**
 * Generate SQL from Prisma schema for manual execution in Supabase
 * This is a workaround if prisma db push hangs or fails
 * 
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/generate-schema-sql.ts
 * Then copy the output SQL and run it in Supabase SQL Editor
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// Read the Prisma schema
const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma')
const schema = readFileSync(schemaPath, 'utf-8')

// Generate basic SQL from the schema
// This is a simplified version - for production, use prisma migrate or db push
console.log('-- SQL Schema for Peak Conditions Assistant')
console.log('-- Copy and paste this into Supabase SQL Editor\n')

console.log('-- Enable UUID extension (if not already enabled)')
console.log('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n')

// Parse models and generate CREATE TABLE statements
const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g
let match

while ((match = modelRegex.exec(schema)) !== null) {
  const modelName = match[1]
  const modelBody = match[2]
  
  // Skip NextAuth models for now - they're complex
  if (['User', 'Account', 'Session', 'VerificationToken'].includes(modelName)) {
    console.log(`-- Table: ${modelName} (NextAuth - will be created automatically on first sign-in)`)
    console.log('-- Or use: npx prisma db push (with proper connection string)\n')
    continue
  }
  
  // Extract fields
  const fieldRegex = /(\w+)\s+(\w+[?\[\]]*)\s*(@[^\n]+)?/g
  const fields: string[] = []
  let fieldMatch
  
  while ((fieldMatch = fieldRegex.exec(modelBody)) !== null) {
    const fieldName = fieldMatch[1]
    const fieldType = fieldMatch[2]
    const attributes = fieldMatch[3] || ''
    
    // Skip relation fields
    if (attributes.includes('@relation')) continue
    
    // Map Prisma types to SQL
    let sqlType = 'TEXT'
    if (fieldType.includes('String')) sqlType = 'TEXT'
    else if (fieldType.includes('Int')) sqlType = 'INTEGER'
    else if (fieldType.includes('Float') || fieldType.includes('Decimal')) sqlType = 'DECIMAL'
    else if (fieldType.includes('Boolean')) sqlType = 'BOOLEAN'
    else if (fieldType.includes('DateTime')) sqlType = 'TIMESTAMP'
    else if (fieldType.includes('Json')) sqlType = 'JSONB'
    
    const nullable = fieldType.includes('?') ? '' : 'NOT NULL'
    const isId = attributes.includes('@id') ? 'PRIMARY KEY' : ''
    const isUnique = attributes.includes('@unique') ? 'UNIQUE' : ''
    
    if (attributes.includes('@default(uuid())')) {
      sqlType = 'UUID'
      fields.push(`  ${fieldName} ${sqlType} ${isId} ${isUnique} DEFAULT uuid_generate_v4() ${nullable}`.trim())
    } else if (attributes.includes('@default(now())')) {
      fields.push(`  ${fieldName} ${sqlType} ${isId} ${isUnique} DEFAULT NOW() ${nullable}`.trim())
    } else {
      fields.push(`  ${fieldName} ${sqlType} ${isId} ${isUnique} ${nullable}`.trim())
    }
  }
  
  if (fields.length > 0) {
    const tableName = modelName.toLowerCase() + 's'
    console.log(`CREATE TABLE IF NOT EXISTS ${tableName} (`)
    console.log(fields.join(',\n'))
    console.log(');\n')
  }
}

console.log('-- Note: This is a simplified schema.')
console.log('-- For full schema with all constraints, use: npx prisma db push')
console.log('-- Or use Prisma Migrate to generate proper migrations')

