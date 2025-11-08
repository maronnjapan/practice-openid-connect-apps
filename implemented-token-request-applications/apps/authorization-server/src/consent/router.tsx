import app from "..";
import { AuthorizeRequestValue } from "../authorize/types";
import { Consent } from "./components/Consent";

export const setUpConsentRoute = (baseApp: typeof app) => {
    baseApp.get('/consent/:dynamicPath', async (c) => {
        // リクエストのURLから動的パス部分を取得
        const { dynamicPath } = c.req.param()
        // 動的パスをキーにしてKVから保存されている値を取得
        const authorizeRequestValue = await c.env.MY_KV_NAMESPACE.get(dynamicPath)
        // 保存されている値が存在しない場合、エラー画面を表示
        if (!authorizeRequestValue) {
            return c.html(<div>不正なアクセスです</div>, 404)
        }
        try {
            const value = JSON.parse(authorizeRequestValue) as AuthorizeRequestValue
            // 保存されているscopeの値を同意画面に渡して表示
            return c.html(
                <Consent scope={value.scope} id={dynamicPath} />
            )
        } catch {
            // JSONのパースに失敗した場合、不正な値が保存されていたのでエラー画面を表示
            return c.html(<div>不正なアクセスです</div>, 404)
        }
    })

    baseApp.post('/consent/:dynamicPath', async (c) => {
        // リクエストパスから動的部分を取得
        const { dynamicPath } = c.req.param()
        // 各種リクエストボディの値を取得
        const requestBody = await c.req.parseBody()
        const consentValue = requestBody['consent']
        const id = requestBody['id']
        // パスの値とリクエストのidが異なる場合はエラーにする
        if (dynamicPath !== id) {
            return c.html(<div>不正なリクエストです</div>, 500)
        }
        // 同意の時のみリクエストを想定しているので、値がyes以外は受け入れない
        if (consentValue !== 'yes') {
            return c.html(<div>不正なリクエストです</div>, 500)
        }
        // Authorization Code開始リクエスト時の紐づけが残っているかを確認 
        const authorizeRequestValue = await c.env.MY_KV_NAMESPACE.get(id)
        if (!authorizeRequestValue) {
            return c.html(<div>不正なリクエストです</div>, 500)
        }
        // 検証がOKであれば、認可コードを発行しredirect_uriのクエリに認可コードを付与してリダイレクトする
        const authorizeRequestJson = JSON.parse(authorizeRequestValue) as AuthorizeRequestValue
        const code = crypto.randomUUID().replaceAll('-', '')
        await c.env.MY_KV_NAMESPACE.put(code,
            authorizeRequestValue
            , { expirationTtl: 300 }) // 5分間保存
        await c.env.MY_KV_NAMESPACE.delete(id) // 使い捨てなので削除する
        return c.redirect(`${authorizeRequestJson.redirectUri}?code=${code}`)
    })
}