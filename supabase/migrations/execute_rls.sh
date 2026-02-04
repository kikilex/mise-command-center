#!/bin/bash

# Script to execute RLS migration
# Uses Supabase Management API

API_TOKEN="sbp_81a17314a395caf2c14dca49643f4cfaac28a511"
PROJECT_ID="hrgluluiwjqgcybswiha"
API_URL="https://api.supabase.com/v1/projects/$PROJECT_ID/database/query"

echo "Starting RLS migration for Mise Command Center..."

# Function to execute SQL
execute_sql() {
    local sql="$1"
    echo "Executing: ${sql:0:100}..."
    
    curl -s -X POST "$API_URL" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$sql\"}"
    
    if [ $? -eq 0 ]; then
        echo "✓ Success"
    else
        echo "✗ Failed"
        return 1
    fi
}

# Read the migration file
MIGRATION_FILE="20260203_enable_rls_all_tables.sql"
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Split by semicolons and execute each statement
IFS=';'
read -ra SQL_STATEMENTS <<< "$SQL_CONTENT"
for statement in "${SQL_STATEMENTS[@]}"; do
    # Remove leading/trailing whitespace and skip empty statements
    trimmed=$(echo "$statement" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [ -n "$trimmed" ]; then
        # Escape quotes for JSON
        escaped=$(echo "$trimmed" | sed 's/"/\\"/g')
        execute_sql "$escaped"
        # Small delay to avoid rate limiting
        sleep 0.5
    fi
done

echo "Migration completed!"