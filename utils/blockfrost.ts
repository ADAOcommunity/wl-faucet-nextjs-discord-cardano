const blockfrostRequest = async ({
    body = null,
    endpoint = '',
    headers = {},
    method = 'GET'
}) => {
    let networkEndpoint = process.env.BLOCKFROST_URL ? process.env.BLOCKFROST_URL : ''
    let blockfrostApiKey = process.env.BLOCKFROST_API_KEY ? process.env.BLOCKFROST_API_KEY : ''

    try {
        return await (
            await fetch(`${networkEndpoint}${endpoint}`, {
                headers: {
                    project_id: blockfrostApiKey,
                    ...headers,
                },
                method: method,
                body,
            })
        ).json();
    } catch (error) {
        console.log(error);
        return null;
    }
}

export default blockfrostRequest