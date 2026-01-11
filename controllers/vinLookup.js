const https = require("https");
const crypto = require("crypto");

const API_BASE_URL = "https://api.vincario.com/3.2";

// Helper function to map transmission types
const mapTransmission = (value) => {
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower.includes("manual") || lower.includes("standard")) return "Manual";
    if (lower.includes("automatic") || lower.includes("auto") || lower.includes("cvt") || lower.includes("dual-clutch")) return "Automatic";
    if (lower.includes("semi")) return "Semi-Automatic";
    return "";
};

// Helper function to map fuel types
const mapFuelType = (value) => {
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower.includes("gasoline") || lower.includes("petrol") || lower.includes("benzin")) return "Petrol";
    if (lower.includes("diesel")) return "Diesel";
    if (lower.includes("hybrid")) return "Hybrid";
    if (lower.includes("electric") || lower.includes("ev")) return "Electric";
    if (lower.includes("lpg")) return "LPG";
    if (lower.includes("hydrogen") || lower.includes("wodór")) return "Wodór";
    return "";
};

// Helper function to map drive types
const mapDriveType = (value) => {
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower.includes("front-wheel") || lower === "fwd") return "FWD";
    if (lower.includes("rear-wheel") || lower === "rwd") return "RWD";
    if (lower.includes("all-wheel") || lower.includes("all wheel") || lower.includes("awd") || lower.includes("4x4") || lower.includes("4wd") || lower.includes("quattro")) return "4WD";
    if (lower.includes("2wd")) return "2WD";
    return "";
};

// Helper function to map body type to UI values
const mapBodyType = (value) => {
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower.includes("wagon") || lower.includes("estate") || lower.includes("variant") || lower.includes("touring") || lower.includes("kombi")) return "Kombi";
    if (lower.includes("sedan") || lower.includes("saloon") || lower.includes("berline")) return "Sedan";
    if (lower.includes("hatchback") || lower.includes("liftback") || lower.includes("sportback")) return "Hatchback";
    if (lower.includes("coupe") || lower.includes("coupé")) return "Coupe";
    if (lower.includes("suv") || lower.includes("4x4") || lower.includes("off-road")) return "SUV";
    if (lower.includes("convertible") || lower.includes("cabrio") || lower.includes("spyder")) return "Convertible";
    if (lower.includes("van") || lower.includes("bus") || lower.includes("minivan") || lower.includes("mpv")) return "Bus";
    if (lower.includes("pickup") || lower.includes("truck")) return "Pickup";
    if (lower.includes("crossover")) return "Crossover";
    if (lower.includes("limousine") || lower.includes("limuzyna")) return "Limousine";
    // Default to capitalized first letter if no match
    return value.charAt(0).toUpperCase() + value.slice(1);
};

exports.getCarDetailsByVin = async (req, res) => {
    try {
        const { vin } = req.query;

        if (!vin || vin.length !== 17) {
            return res.status(400).json({ error: "Invalid VIN. Must be 17 characters." });
        }

        const apiKey = process.env.VINCARIO_API_KEY?.trim();
        const secretKey = process.env.VINCARIO_SECRET_KEY?.trim();

        if (!apiKey || !secretKey) {
            console.error("Missing Vincario API configuration in backend .env");
            return res.status(500).json({ error: "Configuration error. Please ensure VINCARIO_API_KEY and VINCARIO_SECRET_KEY are set in backend .env." });
        }

        console.log(`Backend Looking up VIN with Vincario: ${vin}`);

        // Ensure VIN is uppercase for hash generation as per documentation
        const vinUpper = vin.toUpperCase();

        // Generate Control Sum
        // Formula: substr(sha1("{$vin}|decode|{$apiKey}|{$secretKey}"), 0, 10)
        // Using 'decode' as the operation ID for the standard decode endpoint
        const signatureString = `${vinUpper}|decode|${apiKey}|${secretKey}`;
        const controlSum = crypto.createHash('sha1').update(signatureString).digest('hex').substring(0, 10);

        const url = `${API_BASE_URL}/${apiKey}/${controlSum}/decode/${vinUpper}.json`;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            }
        };

        https.get(url, options, (apiRes) => {
            let data = "";

            apiRes.on("data", (chunk) => {
                data += chunk;
            });

            apiRes.on("end", () => {
                try {
                    // Log response status for debugging
                    console.log("Vincario Status:", apiRes.statusCode);

                    if (apiRes.statusCode !== 200) {
                        // Attempt to parse JSON error from body
                        let errorDetail = data.substring(0, 300);
                        try {
                            const errJson = JSON.parse(data);
                            errorDetail = errJson.error || errJson.message || errorDetail;
                        } catch (e) { }

                        return res.status(apiRes.statusCode === 404 ? 404 : 502).json({
                            error: "External API Error",
                            details: errorDetail
                        });
                    }

                    // Check if response is HTML (error page) 
                    if (data.trim().startsWith("<")) {
                        console.error("Vincario returned HTML:", data.substring(0, 200));
                        return res.status(502).json({
                            error: "Upstream API error: Received HTML instead of JSON",
                            details: "Possible WAF block or invalid endpoint"
                        });
                    }

                    const responseData = JSON.parse(data);

                    // console.log("Vincario Raw Response:", JSON.stringify(responseData));

                    if (responseData && responseData.decode && Array.isArray(responseData.decode)) {

                        // Helper to find value by label
                        const getValue = (label) => {
                            const item = responseData.decode.find(item => item.label === label);
                            return item ? item.value : null;
                        };

                        // Helper to get kW and convert to HP if needed
                        const powerKw = parseFloat(getValue("Engine Power (kW)")) || 0;
                        const powerHp = powerKw ? Math.round(powerKw * 1.34102) : "";

                        // Map the API response to our format
                        const carDetails = {
                            make: getValue("Make") || "",
                            model: getValue("Model") || "",
                            year: getValue("Model Year")?.toString() || "",
                            engine: (getValue("Engine Displacement (ccm)") || getValue("Engine displacement"))?.toString() || "",
                            fuel: mapFuelType(getValue("Fuel Type - Primary") || getValue("Fuel type") || ""),
                            transmission: mapTransmission(getValue("Transmission") || ""),
                            driveType: mapDriveType(getValue("Drive") || ""),
                            bodyClass: mapBodyType(getValue("Body") || ""),
                            vin: vin, // Vincario might not return it explicitly in fields, or it's in "VIN" label
                            manufacturer: getValue("Manufacturer") || "",
                            trim: getValue("Series") || "",
                            horsepower: powerHp.toString(), // Use calculated HP or find "Engine Power (hp)"

                            engineDetails: [
                                getValue("Engine (full)") || getValue("Engine Model"),
                                getValue("Engine Cylinders") ? `${getValue("Engine Cylinders")} Cylinders` : null
                            ].filter(Boolean).join(" "),

                            color: "",
                            mileage: "",
                            country: getValue("Plant Country") || "",
                            accidentHistory: "",
                            serviceHistory: "",
                            type: mapBodyType(getValue("Body") || ""),

                            // Additional technical details
                            engineCode: getValue("Engine Model") || "",
                            engineCylinders: getValue("Engine Cylinders")?.toString() || "",
                            enginePosition: getValue("Engine Position") || "",
                            engineTorque: getValue("Engine Torque (RPM)")?.toString() || "",
                            fuelCapacity: getValue("Fuel Capacity (l)")?.toString() || "",
                            fuelConsumption: getValue("Fuel Consumption Combined (l/100km)")?.toString() || "",
                            transmission_gears: getValue("Number of Gears")?.toString() || "",
                            weight: (getValue("Max Weight (kg)") || getValue("Weight Empty (kg)"))?.toString() || "",
                            maxSpeed: getValue("Max Speed (km/h)")?.toString() || "",
                            acceleration: getValue("Acceleration 0-100 km/h (s)")?.toString() || "",

                            // Dimensions
                            length: getValue("Length (mm)")?.toString() || "",
                            width: getValue("Width (mm)")?.toString() || "",
                            height: getValue("Height (mm)")?.toString() || "",
                            wheelbase: getValue("Wheelbase (mm)")?.toString() || "",
                            emissions: (getValue("CO2 Emission (g/km)") || getValue("Average CO2 Emission (g/km)"))?.toString() || "",
                            emissionStandard: getValue("Emission Standard") || "",
                        };

                        return res.json(carDetails);
                    }

                    return res.status(404).json({
                        error: "Vehicle data not found or invalid VIN",
                        details: responseData?.error || "No data returned"
                    });
                } catch (parseError) {
                    console.error("Error parsing Vincario response:", parseError);
                    res.status(500).json({ error: "Error processing vehicle data" });
                }
            });
        }).on("error", (err) => {
            console.error("Vincario API request failed:", err);
            res.status(500).json({ error: "Failed to fetch vehicle data" });
        });

    } catch (error) {
        console.error("Error in VIN lookup controller:", error);
        res.status(500).json({ error: "Server error during VIN lookup" });
    }
};
