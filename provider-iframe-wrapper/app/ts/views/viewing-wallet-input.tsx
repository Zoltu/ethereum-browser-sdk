import { ErrorHandler } from '../library/error-handler'
import { Wallet, ViewingWallet } from '../library/wallet'
import { AddressInput } from './address-input'

export interface ViewingWalletInputModel {
	readonly errorHandler: ErrorHandler
	readonly jsonRpcEndpoint: string
	readonly fetch: Window['fetch']
	readonly getGasPrice: () => Promise<bigint>
	readonly walletChanged: (wallet: Wallet|undefined) => void
}
export const ViewingWalletInput = (model: ViewingWalletInputModel) => {
	const [address, setAddress] = React.useState<undefined | bigint>(undefined)
	return <>
		<AddressInput errorHandler={model.errorHandler} placeholder={'view only wallet address'} onChange={setAddress}/>
		<button onClick={model.errorHandler.asyncWrapper(async () => {
			const wallet = address === undefined ? undefined : new ViewingWallet(model.jsonRpcEndpoint, model.fetch, model.getGasPrice, address)
			model.walletChanged(wallet)
		})}>Use Wallet</button>
	</>
}
