import { env } from "cloudflare:test"
import { fetchTestApplication } from "../utils"
import { AuthorizeRequestValue } from "../../src/authorize/types"

describe('/consent/:dynamicPath', () => {
    it('パスの値をキーにして保存されているscopeの値が存在する場合、同意画面が表示されること', async () => {
        const TEST_SCOPE = 'profile email'
        const dynamicPath = 'test-dynamic-path'
        const saveValue: AuthorizeRequestValue = {
            scope: TEST_SCOPE,
            clientId: 'test-client-id',
            redirectUri: 'https://example.com/callback',
            responseType: 'code'
        }
        await env.MY_KV_NAMESPACE.put(dynamicPath, JSON.stringify(saveValue))

        const res = await fetchTestApplication(`/consent/${dynamicPath}`)
        const text = await res.text()

        expect(res.status).toEqual(200)
        expect(text).toContain('profile')
        expect(text).toContain('email')
    })
    it('パスの値をキーにして保存されているscopeの値が存在しない場合、エラー画面が表示されること', async () => {
        const dynamicPath = 'non-existent-path'
        const res = await fetchTestApplication(`/consent/${dynamicPath}`)

        expect(res.status).toEqual(404)
    })
})