export const Consent = ({ scope, id }: { scope: string, id: string }) => {
    const scopes = scope.split(' ')
    return (
        <div>
            <h1>同意する</h1>
            <p>以下のスコープが付与されることに同意しますか？</p>
            <ul>
                {scopes.map(s => (
                    <li key={s}>{s}</li>
                ))}
            </ul>
            <form method="post" action={`/consent/${id}`}>
                <input type="hidden" name="consent" value="yes" />
                <input type="hidden" name="id" value={id} />
                <button type="submit">同意する</button>
            </form>
        </div>
    )
}