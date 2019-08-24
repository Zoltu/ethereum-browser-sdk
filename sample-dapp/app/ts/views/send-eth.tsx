import { Address } from '@zoltu/ethereum-types'
import { ErrorHandler } from '../library/error-handler'
import { decimalStringToBigintEth } from '../library/utils'

interface SendEthModel {
	readonly errorHandler: ErrorHandler
	readonly onSendEth: (amount: bigint, destination: Address) => Promise<void>
}
export const SendEth = (model: SendEthModel) => {
	const [amount, setAmount] = React.useState('')
	const [destination, setDestination] = React.useState('')
	const [sending, setSending] = React.useState(false)
	const validate = (): boolean => {
		if (!/^\d+(.\d+)?$/.test(amount)) return false
		if (!/^(0x)?[a-zA-Z0-9]{40}$/.test(destination)) return false
		return true
	}
	const onSubmit = model.errorHandler.asyncWrapper(async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!validate()) return
		if (sending) return
		setSending(true)
		try {
			await model.onSendEth(decimalStringToBigintEth(amount)!, Address.fromHexString(destination))
		} finally {
			setSending(false)
		}
	})
	return <>
		<h3>Send ETH</h3>
		<form className='send-token-form' onSubmit={onSubmit}>
			<input type='number' step='1e-18' placeholder='Amount of ETH to send' pattern='^\d+(?:\.\d+)?$' value={amount} onChange={event => setAmount(event.target.value)} />
			<input type='text' placeholder='Recipient Address' pattern='(?:0x)?[a-zA-Z0-9]{40}' value={destination} onChange={event => setDestination(event.target.value)}/>
			<div className='asset-manager send-token-button-slot'>
				{ !sending && <button type='submit' disabled={!validate()}>Send</button> }
				{ sending && <div className='lds-facebook'><div></div><div></div><div></div></div> }
			</div>
		</form>
	</>
}
