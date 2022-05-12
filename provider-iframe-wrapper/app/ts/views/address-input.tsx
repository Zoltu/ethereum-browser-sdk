import { ErrorHandler } from '../library/error-handler';

export interface AddressInputModel {
	readonly errorHandler: ErrorHandler
	readonly style?: React.CSSProperties
	readonly placeholder?: string
	readonly onChange?: (newValue: bigint | undefined, isEmpty: boolean, isError: boolean) => void
}
export function AddressInput(model: AddressInputModel) {
	const [addressString, setAddressString] = React.useState(window.localStorage.getItem('ethereum-provider-iframe-recoverablewallet-last-used-address') || '')
	const [error, setError] = React.useState('')
	const onChange = model.onChange || (() => {})

	React.useEffect(model.errorHandler.asyncWrapper(async () => {
		setError('')
		if (addressString.length === 0) {
			onChange(undefined, true, false)
			return
		}
		if (!/^(0x)?[a-fA-F0-9]{40}$/.test(addressString)) {
			setError(`Address must be 40 characters long with an optional '0x' prefix.`)
			onChange(undefined, false, true)
			return
		}
		const prefix = (addressString.startsWith('0x')) ? '' : '0x'
		const normalized = `${prefix}${addressString}`
		const address = BigInt(normalized)
		window.localStorage.setItem('ethereum-provider-iframe-recoverablewallet-last-used-address', normalized)
		onChange(address, false, false)
	}), [addressString])

	return <div style={{ ...model.style, display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
		<input style={{ flexGrow: 1, ...(error === '' ? {} : { borderColor: 'red' }) }} placeholder={model.placeholder || '0xadd12e55add12e55add12e55add12e55add12e55'} value={addressString} onChange={event => setAddressString(event.target.value)}/>
		<label style={{ width: '100%', color: 'red', fontSize: '80%' }}>{error}</label>
	</div>
}
