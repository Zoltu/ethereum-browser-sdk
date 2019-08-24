export interface DappSelectorModel {
	readonly navigate: (url: string) => void
	readonly dappAddress: string|undefined
}
export const DappSelector = (model: DappSelectorModel) => {
	const [dappUrl, setDappUrl] = React.useState(model.dappAddress || '')
	const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		// TODO: force SSL
		if (!validate()) return
		model.navigate(dappUrl)
	}
	const validate = (): boolean => {
		// cargo culted from https://www.ietf.org/rfc/rfc3986.txt
		return /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/.test(dappUrl)
	}
	return <>
		<form onSubmit={onSubmit}>
			<input type='text' placeholder='dapp web address' value={dappUrl} onChange={event => setDappUrl(event.target.value)}/>
			<button type='submit'>Navigate</button>
		</form>
	</>
}
