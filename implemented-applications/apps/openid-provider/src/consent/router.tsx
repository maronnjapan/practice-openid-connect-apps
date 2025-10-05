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
}