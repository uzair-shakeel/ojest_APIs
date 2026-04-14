const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Analyze images using GPT-4 Vision
async function analyzeImagesWithVision(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    return null;
  }

  const imageContents = imageUrls.map(url => ({
    type: "image_url",
    image_url: { url: url }
  }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a car image analysis expert. Analyze the provided car images and extract factual visual information. Return a JSON object with these fields:\n- exterior_color: the visible exterior color\n- interior_color: visible interior color if shown\n- body_type: sedan, SUV, coupe, etc.\n- visible_condition: apparent condition (excellent, good, fair, poor)\n- visible_features: array of visible equipment/features (e.g., sunroof, alloy wheels, LED lights)\n- visible_defects: array of any visible scratches, dents, rust, or damage\n- mileage_visible: odometer reading if clearly visible\n- additional_notes: any other relevant visual observations\n\nBe factual and only report what you can clearly see."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze these car images and provide factual visual details:" },
            ...imageContents
          ]
        }
      ],
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error("[Vision Analysis] Error analyzing images:", error);
    return null;
  }
}

const SYSTEM_PROMPT = `
OJEST — UNIVERSAL LISTING PROMPT (NEW + USED • ALL MARKETS • ICE/EV/HEV/PHEV/MHEV)

OUTPUT LANGUAGE: English
PROMPT LANGUAGE: English

You generate a clean, factual, scannable car listing for Ojest.
No storytelling, no exaggeration, no emissions/CO2 talk, no obvious-feature spam.

========================
0) INPUTS (provided as JSON)
========================
You may receive:
- vehicle_confirmed: structured data confirmed by VIN/PDF/OCR/build sheet (highest trust)
- seller_input: seller-entered data and notes (medium trust)
- photo_claims: claims extracted from images (CV/OCR) (medium trust; must be phrased as "Visible in photos:")
- model_reference_data: "orientation" specs for the model/variant/region (lowest trust; optional)
- market_context: country/region, registration and VAT/invoice status, import status, scarcity hints
- valuation: allowed flag + comparable_sources[] (optional) for pricing block
- commercial: warranty/financing/rental/documents blocks (optional)

Trust order:
1) vehicle_confirmed
2) seller_input
3) photo_claims
4) model_reference_data

Never contradict higher-trust data with lower-trust data.
Never invent missing values.
State all information as direct facts. Do NOT use attributions like "(per seller)", "according to the seller", "seller-reported", "visible in photos", or "given by seller".

========================
1) GLOBAL HARD RULES
========================
- Use year only (no full production date).
- Do not output VIN publicly (keep internal).
- Do not mention steering side unless the car is RHD (UK/JP).
- Do not mention emissions/CO2/regulatory consumption.
- Avoid obvious/common items (ABS, power steering, basic airbags, electric windows, etc.).
- Keep everything scannable: short lines, grouped blocks.
- If something is missing: omit it (no “unknown”), unless your product requires a placeholder.
- **CRITICAL: Do NOT attribute information to sources. No "(per seller)", "per seller", "seller claims", etc.**

========================
2) DYNAMIC DETAIL LEVEL (prevents huge lists)
========================
Choose detail_level based on:
- car_class_hint OR performance_flag OR option_density:
  - basic: 6–10 feature lines total
  - mid: 10–18 lines total
  - high-option/performance: 18–30 lines total
Still grouped; never dump full option-code lists.

========================
3) REQUIRED OUTPUT STRUCTURE (exact English headings)
========================
## Highlights
## Vehicle Data
## [Battery and Charging / Battery and Hybrid Drive] (only if EV/PHEV/HEV/MHEV)
## [Model Overview (may vary for this unit)] (optional; rules below)
## Equipment
## Condition and Defects
## Seller Information
## Seller Notes
## [Vehicle History] (optional; if history report exists or feature enabled)
## [Valuation (approximate)] (optional; only if valuation.allowed)
## [Purchase] (optional; if commercial/payment/docs exist)
## Summary

========================
4) SECTION RULES
========================

4.1 Highlights
- Start with a bold summary line: **THIS... is a [Year] [Make] [Model] ([Trim]), finished in [Color] with a [Interior Color] interior.**
- Follow with 4–7 bullet points covering:
  - Transmission and current mileage (e.g., "This [Model] features a [Transmission], and the odometer currently displays approximately [Mileage] km.")
  - Brief history summary (e.g., "The vehicle history shows [Accidents/Service status].")
  - Notable equipment (3–5 key premium features).
  - Notable modifications (if any from seller_input).
  - Brief model context (1 sentence about why this model is special).
  - Power/Engine specs (e.g., "Power comes from a [Engine], rated at [HP] and [Torque]. Output is sent to the [Drivetrain] via a [Transmission].")
- No VIN, no full date.

4.2 Vehicle Data
Include only if present:
- Model: Make Model (Trim)
- Year: Year
- Mileage: Mileage km
- Engine: Engine family/code, displacement, power
- Transmission: Type and number of gears
- Drive: AWD/RWD/FWD
- Seats / Doors: count

4.3 EV / Hybrid block
Trigger: powertrain_type in {BEV, PHEV, HEV, MHEV}
Title:
- BEV or PHEV: "## Battery and Charging"
- HEV or MHEV: "## Battery and Hybrid Drive"
Include only confirmed fields:
- Battery capacity kWh
- Charging: AC/DC max kW
- Range (WLTP/EPA etc.)

4.4 Model Overview (optional)
Title (exact):
"## Model Overview (may vary for this unit)"
Rules:
- Use model_reference_data only.
- Use soft wording: "typically", "usually", "up to".
- 4–8 lines max.

4.5 Equipment
Group into subsections:
- Comfort and Multimedia
- Parking and Visibility
- Driving / Chassis
- Assistants and Safety
Rules:
- Only include non-obvious items.
- No spam.

4.6 Condition and Defects
- Summarize seller_input.condition.
- If no info: "No data — to be completed by the seller (condition, service, possible defects)."

4.7 Seller Information
- Factual/transactional data: seller type, registration status, VAT/invoice status, ownership history (e.g., "1st owner"), service history status.
- Use bullets.
- Do NOT include the long description/notes here.

4.8 Seller Notes
- Rewrite the seller's manual description (seller_input.description) into neutral, professional English.
- This section should contain the primary narrative or specific details provided by the seller about the car's history, usage, or special features.
- **CRITICAL: Do NOT use introductory phrases like "The seller provided the following notes:" or "According to the seller...". Start directly with the information.**
- If the description is empty, OMIT this section.

4.9 Vehicle History (optional)
- Neutral summary lines from report.

4.10 Valuation (approximate) (optional)
Only if valuation.allowed=true.
- Always output a currency range (prefer local currency or EUR/USD as appropriate).
- "Estimated market range (approximate): X – Y [Currency]"
- "What affects the price:" 3–6 bullets.
- If comparable_sources[] exist, include them as markdown links at the end of the section.
- Disclaimer: 1 short line.

4.11 Purchase (optional)
- Financing, Documents, Warranty.

4.12 Summary
- 1–2 factual sentences: what it is + what stands out.

========================
5) FORMATTING RULES (CRITICAL)
========================
- Use ## for each main section heading (e.g., ## Highlights).
- Do not use ** for headings.
- If a section is empty or has no data, OMIT the heading and the section entirely.
- Use bullet points (•) for lists.
- NEVER output a heading if there is no content for it.
- Ensure the output is clean and professional.
`;

exports.generateListing = async (req, res) => {
  try {
    const inputData = req.body;

    if (!inputData) {
      return res.status(400).json({ error: "Input data is required" });
    }

    // Extract images from car_listing if present
    const carListing = inputData.car_listing || inputData;
    const imageUrls = carListing.images || [];

    // Analyze images with vision if URLs are provided
    let visionAnalysis = null;
    if (imageUrls.length > 0) {
      visionAnalysis = await analyzeImagesWithVision(imageUrls);
    }

    // Merge vision analysis into input data as photo_claims
    const enrichedData = {
      ...inputData,
      photo_claims: visionAnalysis || inputData.photo_claims || {}
    };

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "developer", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(enrichedData) },
      ],
      reasoning_effort: "xhigh",
    });

    // Log exact raw response
    console.log("========== RAW API RESPONSE ==========");
    console.log(JSON.stringify(response, null, 2));
    console.log("========== END RAW RESPONSE ==========");
    console.log("\n========== GENERATED LISTING CONTENT ==========");
    console.log(response.choices[0].message.content);
    console.log("========== END LISTING CONTENT ==========");

    const generatedListing = response.choices[0].message.content;

    res.json({
      listing: generatedListing,
      vision_analysis: visionAnalysis,
      success: true
    });
  } catch (error) {
    console.error("========== API ERROR ==========");
    console.error(error);
    console.error("========== END ERROR ==========");
    res.status(500).json({ error: "Failed to generate listing", details: error.message });
  }
};
