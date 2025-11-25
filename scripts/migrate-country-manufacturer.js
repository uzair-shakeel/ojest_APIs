// Migration script to populate countryOfManufacturer for existing cars
// Run this script once to update all existing cars in the database

const mongoose = require("mongoose");
const { Car } = require("./models");

// Country mapping (same as in car.js controller)
const COUNTRY_MAPPING = {
    "Albania": [],
    "Armenia": [],
    "Australia": [],
    "Austria": [],
    "Azerbejdżan": [],
    "Bahrajn": [],
    "Belgia": [],
    "Białoruś": [],
    "Bułgaria": [],
    "Chiny": [
        "BAIC", "Brilliance", "BYD", "Changan", "Chery", "Dongfeng", "Geely",
        "Great Wall Motors", "Haval", "JAC Motors", "JMC", "Lifan", "Nio",
        "Polestar", "Volvo", "Wuling", "Zotye", "MG"
    ],
    "Chorwacja": [],
    "Czarnogóra": [],
    "Czechy": ["Škoda"],
    "Dania": [],
    "Dubaj": [],
    "Estonia": [],
    "Finlandia": [],
    "Francja": ["Alpine", "Bugatti", "Citroën", "DS", "Peugeot", "Renault"],
    "Gruzja": [],
    "Hiszpania": ["Seat"],
    "Holandia": [],
    "Indie": ["Mahindra", "Tata Motors"],
    "Irlandia": [],
    "Islandia": [],
    "Izrael": [],
    "Japonia": [
        "Acura", "Daihatsu", "Honda", "Infiniti", "Isuzu", "Lexus", "Mazda",
        "Mitsubishi", "Nissan", "Subaru", "Suzuki", "Toyota"
    ],
    "Kanada": [],
    "Katar": [],
    "Kazachstan": [],
    "Korea Południowa": ["Daewoo", "Genesis", "Hyundai", "Kia", "SsangYong"],
    "Kuwejt": [],
    "Litwa": [],
    "Luksemburg": [],
    "Łotwa": [],
    "Macedonia Północna": [],
    "Malezja": ["Proton"],
    "Niemcy": [
        "Audi", "BMW", "Maybach", "Mercedes-Benz", "Opel", "Porsche", "Smart", "Volkswagen"
    ],
    "Norwegia": [],
    "Oman": [],
    "Portugalia": [],
    "Rosja": ["Lada"],
    "Rumunia": ["Dacia"],
    "Arabia Saudyjska": [],
    "Serbia": [],
    "Słowacja": [],
    "Słowenia": [],
    "Stany Zjednoczone": [
        "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Fisker", "Ford",
        "GMC", "Hummer", "Jeep", "Lincoln", "Pontiac", "Ram", "Tesla"
    ],
    "Szwajcaria": [],
    "Szwecja": ["Koenigsegg", "Rimac", "Saab"],
    "Turcja": [],
    "Ukraina": [],
    "Węgry": [],
    "Wielka Brytania": [
        "Aston Martin", "Bentley", "Jaguar", "Land Rover", "Lotus", "McLaren",
        "Mini", "Rolls-Royce", "Vauxhall"
    ],
    "Włochy": [
        "Abarth", "Alfa Romeo", "Fiat", "Ferrari", "Lamborghini", "Maserati", "Pagani"
    ],
    "Zjednoczone Emiraty Arabskie": []
};

const getCountryOfManufacturer = (make) => {
    if (!make) return null;
    const normalizedMake = make.trim().toLowerCase();

    for (const [country, brands] of Object.entries(COUNTRY_MAPPING)) {
        if (brands.some(brand => brand.toLowerCase() === normalizedMake)) {
            return country;
        }
    }
    return null;
};

async function migrateCars() {
    try {
        // Connect to MongoDB
        const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/ojest";
        await mongoose.connect(mongoURI);
        console.log("✅ Connected to MongoDB");

        // Find all cars that don't have countryOfManufacturer set
        const carsToUpdate = await Car.find({
            $or: [
                { countryOfManufacturer: { $exists: false } },
                { countryOfManufacturer: null },
                { countryOfManufacturer: "" }
            ]
        });

        console.log(`Found ${carsToUpdate.length} cars to update`);

        let updated = 0;
        let skipped = 0;

        for (const car of carsToUpdate) {
            const country = getCountryOfManufacturer(car.make);

            if (country) {
                car.countryOfManufacturer = country;
                await car.save();
                updated++;
                console.log(`✅ Updated car ${car._id}: ${car.make} -> ${country}`);
            } else {
                skipped++;
                console.log(`⚠️  Skipped car ${car._id}: ${car.make} (no country mapping found)`);
            }
        }

        console.log("\n=== Migration Complete ===");
        console.log(`✅ Updated: ${updated} cars`);
        console.log(`⚠️  Skipped: ${skipped} cars`);
        console.log(`📊 Total processed: ${carsToUpdate.length} cars`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log("✅ Disconnected from MongoDB");
    } catch (error) {
        console.error("❌ Migration error:", error);
        process.exit(1);
    }
}

// Run the migration
migrateCars();
