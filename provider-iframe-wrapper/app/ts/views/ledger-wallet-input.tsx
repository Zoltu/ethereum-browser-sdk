import { ErrorHandler } from '../library/error-handler'
import { Wallet, LedgerWallet } from '../library/wallet'

interface LedgerWalletInputModel {
	readonly errorHandler: ErrorHandler
	readonly jsonRpcEndpoint: string
	readonly fetch: Window['fetch']
	readonly getGasPrice: () => Promise<bigint>
	readonly walletChanged: (wallet: Wallet|undefined) => void
}
export function LedgerWalletInput(model: LedgerWalletInputModel) {
	const onClick = async () => {
		const wallet = await LedgerWallet.create(model.jsonRpcEndpoint, model.fetch, model.getGasPrice)
		model.walletChanged(wallet)
	}
	return <button onClick={model.errorHandler.asyncWrapper(onClick)}>Use Ledger</button>
}
