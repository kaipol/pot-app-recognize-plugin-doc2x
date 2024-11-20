async function recognize(base64, lang, options) {
    const { config, utils } = options;
    const { cacheDir, readBinaryFile } = utils;
    const { apikey } = config;

    if (!apikey || apikey.trim() === "") {
        throw new Error("API key not found");
    }

    const baseUrl = "https://v2.doc2x.noedgeai.com";

    // Step 1: 获取预上传 URL 和 UID
    let preuploadData;
    try {
        const preuploadResponse = await fetch(`${baseUrl}/api/v2/parse/preupload`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apikey}`,
            },
        });

        preuploadData = await preuploadResponse.json();
        if (!preuploadResponse.ok || preuploadData.code !== "success") {
            throw new Error(`Failed to get preupload URL: ${JSON.stringify(preuploadData)}`);
        }
    } catch (error) {
        throw new Error(`Preupload request failed: ${error.message}`);
    }

    const { uid, url: uploadUrl } = preuploadData.data;

    // Step 2: 上传文件到获取的 URL
    let fileContent;
    try {
        const filePath = `${cacheDir}pot_screenshot_cut.png`;
        fileContent = await readBinaryFile(filePath);

        const putResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/octet-stream",
            },
            body: fileContent,
        });

        if (!putResponse.ok) {
            throw new Error(`Failed to upload file: ${putResponse.statusText}`);
        }
    } catch (error) {
        throw new Error(`File upload failed: ${error.message}`);
    }

    // Step 3: 轮询结果
while (true) {
    try {
        const statusResponse = await fetch(`${baseUrl}/api/v2/parse/status?uid=${uid}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apikey}`,
            },
        });

        // 检查响应是否成功
        if (!statusResponse.ok) {
            throw new Error(`Failed to fetch status: HTTP ${statusResponse.status} - ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();

        // 确保返回的数据包含必要字段
        if (!statusData || !statusData.data) {
            throw new Error(`Invalid response format: ${JSON.stringify(statusData)}`);
        }

        const { progress,status,detail,result } = statusData.data;

        if (status === "success") {
            return result.pages[0].md; // 返回第一个页面的 Markdown 内容
        } else if (status === "processing") {
            console.log(`Processing: ${progress}%`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
            throw new Error(`Task failed or unexpected status: ${detail || JSON.stringify(statusData)}`);
        }
    } catch (error) {
        throw new Error(`Error while polling status: ${error.message}`);
    }
}

}
