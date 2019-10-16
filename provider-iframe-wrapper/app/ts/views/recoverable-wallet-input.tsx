import { ErrorHandler } from '../library/error-handler';
import { Wallet, RecoverableWallet, ViewingWallet, ViewingRecoverableWallet } from '../library/wallet';
import { Bytes } from '@zoltu/ethereum-types';
import { AddressInput } from './address-input';
import { WalletSelector } from './wallet-selector';

export interface RecoverableWalletInputModel {
	readonly errorHandler: ErrorHandler
	readonly jsonRpcEndpoint: string
	readonly fetch: Window['fetch']
	readonly getGasPrice: () => Promise<bigint>
	readonly walletChanged: (wallet: Wallet|undefined) => void
}

export const RecoverableWalletInput = (model: RecoverableWalletInputModel) => {
	const [underlyingWallet, setUnderlyingWallet] = React.useState<Wallet|undefined>(undefined)
	const [wallet, setWallet] = React.useState<Wallet|undefined>(undefined)
	const [generatingWallet, setGeneratingWallet] = React.useState(false)
	const [queuedAddressWalletGeneration, setQueuedAddressWalletGeneration] = React.useState<[bigint|undefined,boolean,boolean] | undefined>(undefined)
	const recoverableWalletAddressStringChanged = async (newValue: bigint | undefined, isEmpty: boolean, isError: boolean) => {
		if (generatingWallet) return setQueuedAddressWalletGeneration([newValue, isEmpty, isError])
		setGeneratingWallet(true)
		try {
			if (newValue === undefined) return
			if (underlyingWallet === undefined) throw new Error(`Cannot setup a recoverable wallet without an underlying wallet.`)
			const recoverableWallet = underlyingWallet instanceof ViewingWallet || underlyingWallet instanceof ViewingRecoverableWallet
				? new ViewingRecoverableWallet(underlyingWallet, newValue)
				: new RecoverableWallet(underlyingWallet, newValue)
			const result = await underlyingWallet.localContractCall({
				contract_address: newValue,
				method_signature: 'owner()',
				method_parameters: [],
				value: 0n,
			})
			const ownerAddress = Bytes.fromByteArray(result).toUnsignedBigint()
			if (ownerAddress !== underlyingWallet.address) throw new Error(`The currently selected signing wallet (${underlyingWallet.address.toString(16).padStart(40, '0')}) is not the owner of this wallet, ${ownerAddress.toString(16).padStart(40, '0')} is.`)
			setWallet(recoverableWallet)
		} finally {
			setGeneratingWallet(false)
			if (queuedAddressWalletGeneration !== undefined) {
				setQueuedAddressWalletGeneration(undefined)
				await recoverableWalletAddressStringChanged(...queuedAddressWalletGeneration)
			}
		}
	}
	// TODO: better error handling, should display errors inline (like validation), especially non terminal ones
	return <div>
		{underlyingWallet === undefined && <>
			<h3>Choose an Underlying Wallet</h3>
			<WalletSelector errorHandler={model.errorHandler} fetch={model.fetch} jsonRpcEndpoint={model.jsonRpcEndpoint} getGasPrice={model.getGasPrice} walletChanged={setUnderlyingWallet}/>
		</>}
		{underlyingWallet !== undefined && <AddressInput placeholder='Recoverable Wallet Address' errorHandler={model.errorHandler} onChange={model.errorHandler.asyncWrapper(recoverableWalletAddressStringChanged)}/>}
		{underlyingWallet !== undefined && wallet !== undefined && <button onClick={() => model.walletChanged(wallet)}>Use Wallet</button>}
	</div>
}
