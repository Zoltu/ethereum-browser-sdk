import { ErrorHandler } from '../library/error-handler';

export interface AddressInputModel {
	readonly errorHandler: ErrorHandler
	readonly style?: React.CSSProperties
	readonly placeholder?: string
	readonly onChange?: (newValue: bigint | undefined, isEmpty: boolean, isError: boolean) => void
}
export function AddressInput(model: AddressInputModel) {
	const [addressString, setAddressString] = React.useState('')
	const [error, setError] = React.useState('')
	const onChange = model.onChange || (() => {})
	const addressChanged = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void | string> => {
		setAddressString(event.target.value)
		setError('')
		if (event.target.value.length === 0) return onChange(undefined, true, false)
		if (!/^(0x)?[a-fA-F0-9]{40}$/.test(event.target.value)) {
			setError(`Address must be 40 characters long with an optional '0x' prefix.`)
			onChange(undefined, false, true)
			return
		}
		const prefix = (event.target.value.startsWith('0x')) ? '' : '0x'
		const normalized = `${prefix}${event.target.value}`
		const address = BigInt(normalized)
		onChange(address, false, false)
	}
	return <div style={{ ...model.style, display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
		<input style={{ flexGrow: 1, ...(error === '' ? {} : { borderColor: 'red' }) }} placeholder={model.placeholder || '0xadd12e55add12e55add12e55add12e55add12e55'} value={addressString} onChange={model.errorHandler.asyncWrapper(addressChanged)}/>
		<label style={{ width: '100%', color: 'red', fontSize: '80%' }}>{error}</label>
	</div>
}
