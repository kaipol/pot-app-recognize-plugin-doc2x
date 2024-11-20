const axios = require('axios');
const fs = require('fs').promises;

async function recognize(base64, lang, options) {
    const { config, utils } = options;
    const { cacheDir, readBinaryFile, http } = utils;
    let { formula, img_correction, apikey } = config;

    if (!apikey || apikey.trim() === "") {
        throw new Error("API key not found");
    }
    formula = formula || "0";
    img_correction = img_correction || "0";

    const baseUrl = "https://v2.doc2x.noedgeai.com";

    // Read the cached file
    const filePath = `${cacheDir}pot_screenshot_cut.png`;
    let fileContent;
    try {
        fileContent = await readBinaryFile(filePath);
    } catch (error) {
        throw new Error(`Failed to read file: ${error.message}`);
    }

    // Upload image and get UID
    let uid;
    try {
        const uidResponse = await axios.post(
            `${baseUrl}/api/v2/parse/preload`,
            http.Body.form({
                file: {
                    file: fileContent,
                    mime: 'image/png',
                    fileName: 'pot_screenshot_cut.png',
                },
                img_correction,
                equation: formula,
            }),
            {
                headers: {
                    "Authorization": `Bearer ${apikey}`,
                },
            }
        );
        if (uidResponse.data && uidResponse.data.data && uidResponse.data.data.uid) {
            uid = uidResponse.data.data.uid;
        } else {
            throw new Error("UID not found in the response");
        }
    } catch (error) {
        throw new Error(`Error uploading image: ${error.message}`);
    }

    // Poll for the result
    while (true) {
        try {
            const statusResponse = await axios.get(
                `${baseUrl}/api/v2/parse/status?uid=${uid}`,
                {
                    headers: {
                        "Authorization": `Bearer ${apikey}`,
                    },
                }
            );

            const statusData = statusResponse.data.data;
            if (statusData.status === "success") {
                return statusData.result.pages[0].md;
            } else if (statusData.status === "processing" || statusData.status === "ready") {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            } else if (statusData.status === "pages limit exceeded") {
                throw new Error("Pages limit exceeded");
            } else {
                throw new Error(`Unexpected status: ${JSON.stringify(statusData)}`);
            }
        } catch (error) {
            throw new Error(`Error fetching status: ${error.message}`);
        }
    }
}
