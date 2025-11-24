// Native fetch is available in Node.js 18+
// If using older Node.js, install node-fetch: npm install node-fetch

const DETECTION_API_URL = "https://ojest.pl/image/separation/api/detect";

/**
 * Detect image category using external AI API
 * @route POST /api/image-detection/detect
 */
exports.detectImageCategory = async (req, res) => {
    try {
        console.log("HIT /api/image-detection/detect endpoint");
        const { image_url } = req.body;

        if (!image_url) {
            return res.status(400).json({ error: "No image_url provided" });
        }

        // Normalize the image URL - ensure it's a full, publicly accessible URL
        let normalizedUrl = image_url.trim();

        // If it's not already a full URL (starts with http:// or https://)
        if (!/^https?:\/\//i.test(normalizedUrl)) {
            // Check if it's a Cloudinary URL without protocol (starts with //)
            if (normalizedUrl.startsWith("//")) {
                normalizedUrl = `https:${normalizedUrl}`;
            } else if (
                normalizedUrl.includes("cloudinary.com") ||
                normalizedUrl.includes("res.cloudinary.com")
            ) {
                // Cloudinary URL missing protocol
                normalizedUrl = `https://${normalizedUrl}`;
            } else {
                // For relative paths, construct full URL using API base
                const API_BASE =
                    process.env.NEXT_PUBLIC_API_BASE_URL ||
                    process.env.NEXT_PUBLIC_API_URL ||
                    "";
                if (API_BASE) {
                    // Remove leading slash if present to avoid double slashes
                    const cleanPath = normalizedUrl.startsWith("/")
                        ? normalizedUrl.slice(1)
                        : normalizedUrl;
                    normalizedUrl = `${API_BASE}/${cleanPath}`;
                } else {
                    // Fallback: assume it might be a protocol-relative URL
                    normalizedUrl = normalizedUrl.startsWith("//")
                        ? `https:${normalizedUrl}`
                        : `https://${normalizedUrl}`;
                }
            }
        }

        // Ensure Cloudinary URLs are properly formatted
        if (
            normalizedUrl.includes("cloudinary.com") &&
            !normalizedUrl.includes("res.cloudinary.com")
        ) {
            normalizedUrl = normalizedUrl.replace(
                "cloudinary.com",
                "res.cloudinary.com"
            );
        }

        console.log("Normalized image URL for detection:", {
            original: image_url?.substring(0, 100),
            normalized: normalizedUrl?.substring(0, 100),
            isCloudinary: normalizedUrl?.includes("cloudinary.com"),
            isFullUrl: /^https?:\/\//i.test(normalizedUrl),
        });

        // Call the external detection API
        const response = await fetch(DETECTION_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                image_url: normalizedUrl,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Detection API error:", {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
            });
            return res.status(response.status).json({
                error: `Detection API error: ${response.status} - ${errorText}`,
            });
        }

        const data = await response.json();
        console.log("Detection API success response:", {
            success: data.success,
            category: data.category,
            detected_label: data.detected_label,
            confidence: data.confidence,
        });

        return res.json(data);
    } catch (error) {
        console.error("Error in detectImageCategory:", error);
        return res.status(500).json({
            error: error.message || "Failed to process image detection",
        });
    }
};
