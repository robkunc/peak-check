#!/bin/bash

# Database Migration Script
# Usage: ./scripts/migrate-db.sh
# 
# This script dumps the contents of one Postgres database and restores it to another.
# It uses pg_dump and psql, which must be installed.

set -e

echo "🏔️  Peak Check Database Migration Tool"
echo "======================================"
echo "This script will migrate ALL data from your source database to a target database."
echo ""

# Check for required tools
if ! command -v pg_dump &> /dev/null; then
    echo "❌ Error: pg_dump is not installed or not in PATH."
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed or not in PATH."
    exit 1
fi

# Prompt for Source DB
echo "👉 Enter Source Database Connection String (Old DB):"
echo "   (Format: postgresql://user:pass@host:5432/db?sslmode=require)"
read -s SOURCE_DB_URL
echo ""

if [ -z "$SOURCE_DB_URL" ]; then
    echo "❌ Source URL is required."
    exit 1
fi

# Prompt for Target DB
echo "👉 Enter Target Database Connection String (New DB):"
echo "   (Warning: This will OVERWRITE data in the target database!)"
read -s TARGET_DB_URL
echo ""

if [ -z "$TARGET_DB_URL" ]; then
    echo "❌ Target URL is required."
    exit 1
fi

echo "⚠️  WARNING: You are about to copy data from:"
echo "   Source: [HIDDEN]"
echo "   To:     [HIDDEN]"
echo ""
echo "This process involves:"
echo "1. Dumping schema and data from Source."
echo "2. Applying it to Target."
echo ""
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Cancelled."
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="db_dump_$TIMESTAMP.sql"

echo ""
echo "⏳ Step 1: Dumping source database to $DUMP_FILE..."
# Use --clean to drop existing objects in target, --if-exists to avoid errors
# --no-owner --no-acl to avoid permission issues across different users/hosts
pg_dump "$SOURCE_DB_URL" \
  --format=plain \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --quote-all-identifiers \
  > "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Dump successful."
else
    echo "❌ Dump failed."
    rm "$DUMP_FILE"
    exit 1
fi

echo ""
echo "⏳ Step 2: Restoring to target database..."
# Use psql to execute the dump
psql "$TARGET_DB_URL" -f "$DUMP_FILE" > restore_log.txt 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Restore successful!"
    echo "   (Logs saved to restore_log.txt)"
else
    echo "❌ Restore failed. Check restore_log.txt for details."
    # Don't delete dump file in case of error so user can inspect or retry
    exit 1
fi

# Cleanup
rm "$DUMP_FILE"
echo ""
echo "🎉 Migration Complete!"
