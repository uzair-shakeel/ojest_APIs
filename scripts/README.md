# Country Manufacturer Migration Script

## Purpose
This script populates the `countryOfManufacturer` field for existing cars in the database that don't have this field set.

## When to Run
Run this script if:
- You have existing cars in the database that were created before the `countryOfManufacturer` field was added
- The country filter (Kraj Producenta) is not working for existing cars
- You see cars with missing `countryOfManufacturer` values in the database

## How to Run

### Option 1: Using Node directly
```bash
cd c:\Users\WorkStation\Videos\Ojest\ojest_APIs
node scripts/migrate-country-manufacturer.js
```

### Option 2: Add to package.json scripts
Add this to your `package.json` scripts section:
```json
"scripts": {
  "migrate:country": "node scripts/migrate-country-manufacturer.js"
}
```

Then run:
```bash
npm run migrate:country
```

## What it Does
1. Connects to your MongoDB database
2. Finds all cars where `countryOfManufacturer` is missing, null, or empty
3. For each car, determines the country based on the car's `make` (brand)
4. Updates the car with the correct `countryOfManufacturer` value
5. Reports the number of cars updated and skipped

## Expected Output
```
✅ Connected to MongoDB
Found 50 cars to update
✅ Updated car 123abc: BMW -> Niemcy
✅ Updated car 456def: Toyota -> Japonia
...
=== Migration Complete ===
✅ Updated: 48 cars
⚠️  Skipped: 2 cars
📊 Total processed: 50 cars
✅ Disconnected from MongoDB
```

## Notes
- The script is safe to run multiple times - it only updates cars that need updating
- Cars with unknown makes (not in the COUNTRY_MAPPING) will be skipped
- Make sure your MongoDB connection string is set in the MONGO_URI environment variable
