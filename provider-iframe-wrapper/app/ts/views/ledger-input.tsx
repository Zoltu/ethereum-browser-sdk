import { ErrorHandler } from '../library/error-handler'
import { Wallet, createLedgerWallet } from '../library/wallet'

interface LedgerInputModel {
	readonly errorHandler: ErrorHandler
	readonly walletChanged: (wallet: Wallet|undefined) => void
}
export function LedgerInput(model: LedgerInputModel) {
	const onClick = async () => model.walletChanged(await createLedgerWallet())
	return <button onClick={model.errorHandler.asyncWrapper(onClick)}>Use Ledger</button>
}
