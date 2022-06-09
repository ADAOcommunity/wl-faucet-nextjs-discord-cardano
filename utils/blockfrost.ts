const blockfrostRequest = async ({
    body = null,
    endpoint = '',
    headers = {},
    method = 'GET'
}) => {
    let networkEndpoint = 'https://cardano-testnet.blockfrost.io/api/v0' //process.env.BLOCKFROST_URL ? process.env.BLOCKFROST_URL : ''
    let blockfrostApiKey = 'testnetRvOtxC8BHnZXiBvdeM9b3mLbi8KQPwzA' //process.env.BLOCKFROST_API_KEY ? process.env.BLOCKFROST_API_KEY : ''

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