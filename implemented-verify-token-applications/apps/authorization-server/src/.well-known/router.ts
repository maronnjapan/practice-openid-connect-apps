import app from "..";

export const setUpWellKnownRoutes = (baseApp: typeof app) => {
    baseApp.get('/.well-known/jwks.json', async (c) => {
        const publicKeyStr = c.env.PUBLIC_KEY;
        return c.json({
            keys: [
                {
                    ...JSON.parse(publicKeyStr),
                    kid: '1'
                }
            ]
        })
    })
}