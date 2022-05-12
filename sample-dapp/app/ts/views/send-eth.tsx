import { ErrorHandler } from '../library/error-handler'
import { decimalStringToBigint, hexStringToBigint } from '../library/utils'

interface SendEthModel {
	readonly errorHandler: ErrorHandler
	readonly onSendEth: (amount: bigint, destination: bigint) => Promise<void>
}
export const SendEth = (model: SendEthModel) => {
	const [amountString, setAmountString] = React.useState('')
	const [destinationString, setDestinationString] = React.useState('')
	const [sending, setSending] = React.useState(false)
	const validate = (): boolean => {
		if (!/^\d+(.\d+)?$/.test(amountString)) return false
		if (!/^(0x)?[a-zA-Z0-9]{40}$/.test(destinationString)) return false
		return true
	}
	const onSubmit = model.errorHandler.asyncWrapper(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!validate()) return
		if (sending) return
		setSending(true)
		try {
			// we can only reach this code if `validate` passes, so we know that at this point both of these values will match the expected form
			const amount = decimalStringToBigint(amountString, 18n)!
			const destination = hexStringToBigint(destinationString)!
			await model.onSendEth(amount, destination)
		} finally {
			setSending(false)
		}
	})
	return <>
		<h3>Send ETH</h3>
		<form className='send-token-form' onSubmit={onSubmit}>
			<input type='number' step='1e-18' placeholder='Amount of ETH to send' pattern='^\d+(?:\.\d+)?$' value={amountString} onChange={event => setAmountString(event.target.value)} />
			<input type='text' placeholder='Recipient Address' pattern='(?:0x)?[a-zA-Z0-9]{40}' value={destinationString} onChange={event => setDestinationString(event.target.value)}/>
			<div className='asset-manager send-token-button-slot'>
				{ !sending && <button type='submit' disabled={!validate()}>Send</button> }
				{ sending && <div className='lds-facebook'><div></div><div></div><div></div></div> }
			</div>
		</form>
	</>
}
