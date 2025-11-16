#!/bin/bash
# Script to replace console.log/warn/error with structured logger
# Usage: ./replace-console-with-logger.sh

set -e

SRC_DIR="/home/user/CortexDx/packages/cortexdx/src"

echo "Replacing console statements with structured logger..."

# Find all TypeScript files with console usage
FILES=$(grep -rl "console\\.log\|console\\.warn\|console\\.error" "$SRC_DIR" --include="*.ts" || true)

if [ -z "$FILES" ]; then
    echo "No files found with console usage"
    exit 0
fi

for file in $FILES; do
    # Skip logger.ts itself
    if [[ "$file" == *"logging/logger.ts" ]]; then
        continue
    fi

    # Check if file already imports logger
    if ! grep -q "from.*logging/logger" "$file"; then
        # Calculate relative path to logging/logger
        DIR=$(dirname "$file")
        REL_PATH=$(realpath --relative-to="$DIR" "$SRC_DIR/logging/logger.ts")
        REL_PATH="${REL_PATH%.ts}.js"  # Convert to .js for import

        # Add import after existing imports
        # Find the last import line
        LAST_IMPORT=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1 || echo "0")

        if [ "$LAST_IMPORT" != "0" ]; then
            # Add logger import after last import
            sed -i "${LAST_IMPORT}a\\import { createLogger } from \"$REL_PATH\";" "$file"
            # Add logger const after imports section
            sed -i "${LAST_IMPORT}a\\const logger = createLogger(\"$(basename ${file%.ts})\");" "$file"
            sed -i "${LAST_IMPORT}a\\" "$file"
        fi
    fi

    # Replace console statements
    sed -i 's/console\.log(/logger.info(/g' "$file"
    sed -i 's/console\.warn(/logger.warn(/g' "$file"
    sed -i 's/console\.error(/logger.error(/g' "$file"
    sed -i 's/console\.debug(/logger.debug(/g' "$file"

    echo "✓ Updated: $file"
done

echo ""
echo "Replacement complete!"
echo "Files updated: $(echo "$FILES" | wc -l)"
