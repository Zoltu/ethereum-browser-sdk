import { Address } from '@zoltu/ethereum-types'
import { ErrorHandler } from '../library/error-handler'
import { Wallet, createNonSigningWallet } from '../library/wallet'

export interface AddressInputModel {
	readonly errorHandler: ErrorHandler
	readonly walletChanged: (wallet: Wallet|undefined) => void
	readonly emptyStateChanged: (isEmpty: boolean) => void
}
export const AddressInput = (model: AddressInputModel) => {
	const [walletAddress, setWalletAddress] = React.useState('')
	const [generatingWallet, setGeneratingWallet] = React.useState(false)
	const [queuedAddressWalletGeneration, setQueuedAddressWalletGeneration] = React.useState<React.ChangeEvent<HTMLInputElement>|undefined>(undefined)
	const addressChanged = async (event: React.ChangeEvent<HTMLInputElement>) => {
		setWalletAddress(event.target.value)
		model.emptyStateChanged(event.target.value === '')
		if (generatingWallet) return setQueuedAddressWalletGeneration(event)
		setGeneratingWallet(true)
		try {
			const address = /^(0x)?[a-zA-Z0-9]{40}$/.test(event.target.value) ? Address.fromHexString(event.target.value) : undefined
			const wallet = address === undefined ? undefined : await createNonSigningWallet(address)
			model.walletChanged(wallet)
		} finally {
			setGeneratingWallet(false)
			if (queuedAddressWalletGeneration !== undefined) {
				await addressChanged(queuedAddressWalletGeneration)
				setQueuedAddressWalletGeneration(undefined)
			}
		}
	}
	return <input placeholder='wallet address' value={walletAddress} onChange={model.errorHandler.asyncWrapper(addressChanged)}/>
}
