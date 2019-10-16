import { mnemonic } from '@zoltu/ethereum-crypto'
import { ErrorHandler } from '../library/error-handler'
import { Wallet, MnemonicWallet } from '../library/wallet'

export interface MnemonicWalletInputModel {
	readonly errorHandler: ErrorHandler
	readonly jsonRpcEndpoint: string
	readonly fetch: Window['fetch']
	readonly getGasPrice: () => Promise<bigint>
	readonly walletChanged: (wallet: Wallet|undefined) => void
}
export const MnemonicWalletInput = (model: MnemonicWalletInputModel) => {
	const [mnemonicWords, setMnemonicWords] = React.useState<string>('')
	const [mnemonicError, setMnemonicError] = React.useState<string|undefined>('')
	const [wallet, setWallet] = React.useState<Wallet|undefined>(undefined)
	const [generatingWallet, setGeneratingWallet] = React.useState(false)
	const [generatingRandomMnemonic, setGeneratingRandomMnemonic] = React.useState(false)
	const [queuedMnemonicWalletGeneration, setQueuedMnemonicWalletGeneration] = React.useState<string[]|undefined>(undefined)
	const generateRandomMnemonic = async () => {
		if (generatingRandomMnemonic) return
		setGeneratingRandomMnemonic(true)
		try {
			const words = await mnemonic.generateRandom(128)
			setMnemonicWords(words.join(' '))
			await mnemonicWordsChanged(words)
		} finally {
			setGeneratingRandomMnemonic(false)
		}
	}
	const inputChanged = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
		setMnemonicWords(event.target.value)
		await mnemonicWordsChanged(event.target.value.trim().split(' ').filter(x => x !== ''))
	}
	const mnemonicWordsChanged = async (words: string[]) => {
		if (generatingWallet) return setQueuedMnemonicWalletGeneration(words)
		setGeneratingWallet(true)
		setMnemonicError('')
		try {
			if (words.length === 0) return model.walletChanged(undefined)
			const mnemonicError = await mnemonic.getErrorReason(words)
			setMnemonicError(mnemonicError === null ? '' : mnemonicError)
			const wallet = mnemonicError === null ? await MnemonicWallet.create(model.jsonRpcEndpoint, model.fetch, model.getGasPrice, words) : undefined
			setWallet(wallet)
		} finally {
			setGeneratingWallet(false)
			if (queuedMnemonicWalletGeneration !== undefined) {
				setQueuedMnemonicWalletGeneration(undefined)
				await mnemonicWordsChanged(queuedMnemonicWalletGeneration)
			}
		}
	}
	return <>
		{generatingRandomMnemonic && <label>Spinner</label>}
		{!generatingRandomMnemonic && <>
			<button onClick={model.errorHandler.asyncWrapper(generateRandomMnemonic)}>Generate New Wallet</button>
			<input type='text' placeholder='mnemonic words' value={mnemonicWords} onChange={model.errorHandler.asyncWrapper(inputChanged)}/>
			{mnemonicError !== undefined && <div className='mnemonic-error'>{mnemonicError}</div>}
			{wallet !== undefined && <div><label>Address: </label><label className='monospace'>{wallet.address.toString(16)}</label></div>}
			<button onClick={() => model.walletChanged(wallet)}>Use Wallet</button>
		</>}
	</>
}
