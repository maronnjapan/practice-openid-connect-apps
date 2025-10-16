import { env } from "cloudflare:test"
import { fetchTestApplication } from "../utils"
import { AuthorizeRequestValue } from "../../src/authorize/types"

describe('GET /consent/:dynamicPath', () => {
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

describe('POST  /consent/:dynamicPath', () => {
    const DYNAMIC_PATH = 'test-dynamic-path'
    it('Authorization Code開始リクエスト時の値と認可コードを紐づけた状態で、認可コードを付きでリダイレクトされること', async () => {
        const saveValue: AuthorizeRequestValue = {
            scope: 'profile email',
            clientId: 'test-client-id',
            redirectUri: 'https://example.com/callback',
            responseType: 'code'
        }
        await env.MY_KV_NAMESPACE.put(DYNAMIC_PATH, JSON.stringify(saveValue))

        const res = await fetchTestApplication(`/consent/${DYNAMIC_PATH}`, {
            method: 'POST',
            body: new URLSearchParams({
                consent: 'yes',
                id: DYNAMIC_PATH
            })
        })

        const redirectUrl = new URL(res.headers.get('Location') || '')
        const code = redirectUrl.searchParams.get('code')
        const value = await env.MY_KV_NAMESPACE.get(code)

        expect(res.status).toEqual(302)
        expect(redirectUrl.origin).toEqual('https://example.com')
        expect(redirectUrl.pathname).toEqual('/callback')
        expect(code).not.toBeNull()
        expect(code).toMatch(/^[a-zA-Z0-9-_.]+$/)
        expect(JSON.parse(value)).toEqual(saveValue)
    })
    it('Authorization Code開始リクエスト時にstateが存在する場合、stateも付与した状態でリダイレクトされること', async () => {
        const TEST_STATE = 'test-state'
        const saveValue: AuthorizeRequestValue = {
            scope: 'profile email',
            clientId: 'test-client-id',
            redirectUri: 'https://example.com/callback',
            responseType: 'code',
            state: TEST_STATE
        }
        await env.MY_KV_NAMESPACE.put(DYNAMIC_PATH, JSON.stringify(saveValue))

        const res = await fetchTestApplication(`/consent/${DYNAMIC_PATH}`, {
            method: 'POST',
            body: new URLSearchParams({
                consent: 'yes',
                id: DYNAMIC_PATH
            })
        })

        const redirectUrl = new URL(res.headers.get('Location') || '')
        const state = redirectUrl.searchParams.get('state')

        expect(res.status).toEqual(302)
        expect(state).toEqual(TEST_STATE)
    })
    it('リクエストのパスの値と、フォームで送られてきたidの値が異なる場合、エラー画面が表示されること', async () => {
        const saveValue: AuthorizeRequestValue = {
            scope: 'profile email',
            clientId: 'test-client-id',
            redirectUri: 'https://example.com/callback',
            responseType: 'code'
        }
        await env.MY_KV_NAMESPACE.put(DYNAMIC_PATH, JSON.stringify(saveValue))

        const res = await fetchTestApplication(`/consent/invalid-id`, {
            method: 'POST',
            body: new URLSearchParams({
                consent: 'yes',
                id: DYNAMIC_PATH
            })
        })

        expect(res.status).toEqual(500)
    })
    it('パスに紐づくデータがKey Valueストアに存在しない場合、エラー画面が表示されること', async () => {
        const res = await fetchTestApplication(`/consent/${DYNAMIC_PATH}`, {
            method: 'POST',
            body: new URLSearchParams({
                consent: 'yes',
                id: DYNAMIC_PATH
            })
        })

        expect(res.status).toEqual(500)
    })
    it('同意を示した値が存在しない場合、エラー画面が表示されること', async () => {
        const saveValue: AuthorizeRequestValue = {
            scope: 'profile email',
            clientId: 'test-client-id',
            redirectUri: 'https://example.com/callback',
            responseType: 'code'
        }
        await env.MY_KV_NAMESPACE.put(DYNAMIC_PATH, JSON.stringify(saveValue))

        const res = await fetchTestApplication(`/consent/${DYNAMIC_PATH}`, {
            method: 'POST',
            body: new URLSearchParams({
                consent: 'no',
                id: DYNAMIC_PATH
            })
        })

        expect(res.status).toEqual(500)
    })
})