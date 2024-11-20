async function recognize(base64, lang, options) {
    const { config, utils } = options;
    const { cacheDir, readBinaryFile,tauriFetch } = utils;
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
        const formData = new FormData();
        formData.append("file", new Blob([fileContent], { type: "image/png" }), "pot_screenshot_cut.png");
        formData.append("img_correction", img_correction);
        formData.append("equation", formula);

        const response = await tauriFetch(`${baseUrl}/api/v2/parse/preload`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apikey}`,
            },
            body: formData,
        });

        const result = await response.json();
        if (response.ok && result.data && result.data.uid) {
            uid = result.data.uid;
        } else {
            throw new Error(`Error uploading image: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        throw new Error(`Error uploading image: ${error.message}`);
    }

    // Poll for the result
    while (true) {
        try {
            const statusResponse = await tauriFetch(`${baseUrl}/api/v2/parse/status?uid=${uid}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apikey}`,
                },
            });

            const statusResult = await statusResponse.json();
            if (statusResponse.ok) {
                const statusData = statusResult.data;
                if (statusData.status === "success") {
                    return statusData.result.pages[0].md;
                } else if (statusData.status === "processing" || statusData.status === "ready") {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                } else if (statusData.status === "pages limit exceeded") {
                    throw new Error("Pages limit exceeded");
                } else {
                    throw new Error(`Unexpected status: ${JSON.stringify(statusData)}`);
                }
            } else {
                throw new Error(`Error tauriFetching status: ${JSON.stringify(statusResult)}`);
            }
        } catch (error) {
            throw new Error(`Error tauriFetching status: ${error.message}`);
        }
    }
}
