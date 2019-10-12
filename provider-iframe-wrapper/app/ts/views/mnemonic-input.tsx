import { mnemonic } from '@zoltu/ethereum-crypto'
import { ErrorHandler } from '../library/error-handler'
import { Wallet, createMemoryWallet } from '../library/wallet'

export interface MnemonicInputModel {
	readonly errorHandler: ErrorHandler
	readonly walletChanged: (wallet: Wallet|undefined) => void
	readonly emptyStateChanged: (isEmpty: boolean) => void
}
export const MnemonicInput = (model: MnemonicInputModel) => {
	const [mnemonicWords, setMnemonicWords] = React.useState<string>('')
	const [mnemonicError, setMnemonicError] = React.useState('')
	const [generatingWallet, setGeneratingWallet] = React.useState(false)
	const [generatingRandomMnemonic, setGeneratingRandomMnemonic] = React.useState(false)
	const [queuedMnemonicWalletGeneration, setQueuedMnemonicWalletGeneration] = React.useState<string[]|undefined>(undefined)
	const generateRandomMnemonic = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
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
		model.emptyStateChanged(words.length === 0)
		if (generatingWallet) return setQueuedMnemonicWalletGeneration(words)
		setGeneratingWallet(true)
		setMnemonicError('')
		try {
			if (words.length === 0) return model.walletChanged(undefined)
			const mnemonicError = await mnemonic.getErrorReason(words)
			setMnemonicError(mnemonicError === null ? '' : mnemonicError)
			const wallet = mnemonicError === null ? await createMemoryWallet(words) : undefined
			model.walletChanged(wallet)
		} finally {
			setGeneratingWallet(false)
			if (queuedMnemonicWalletGeneration !== undefined) {
				await mnemonicWordsChanged(queuedMnemonicWalletGeneration)
				setQueuedMnemonicWalletGeneration(undefined)
			}
		}
	}
	return <form className='mnemonic' onSubmit={model.errorHandler.asyncWrapper(generateRandomMnemonic)}>
		<input type='text' placeholder='mnemonic' value={mnemonicWords} onChange={model.errorHandler.asyncWrapper(inputChanged)}/>
		<button type='submit' disabled={generatingRandomMnemonic}>Generate</button>
		{mnemonicError !== '' && <div className='mnemonic-error'>{mnemonicError}</div>}
	</form>
}
