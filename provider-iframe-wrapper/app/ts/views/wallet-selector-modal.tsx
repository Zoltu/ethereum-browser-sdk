import { ErrorHandler } from '../library/error-handler'
import { Wallet } from '../library/wallet'
import { WalletSelector } from './wallet-selector'

export interface WalletSelectorModalModel {
	readonly errorHandler: ErrorHandler
	readonly jsonRpcEndpoint: string
	readonly fetch: Window['fetch']
	readonly getGasPrice: () => Promise<bigint>
	readonly walletChanged: (wallet: Wallet|undefined) => void
	readonly wallet: Wallet|undefined
}
export const WalletSelectorModal = (model: WalletSelectorModalModel) => {
	const [isModalOpen, setIsModalOpen] = React.useState(false)
	const walletChanged = (newWallet: Wallet|undefined) => {
		setIsModalOpen(false)
		model.walletChanged(newWallet)
	}
	return <>
		<button onClick={() => setIsModalOpen(true)}>Select Wallet</button>
		{model.wallet !== undefined && <div><label>Address: </label><label className='monospace'>{model.wallet.address.toString(16)}</label></div>}
		{isModalOpen && <div style={{ position: 'fixed', top: '0px', bottom: '0px', left: '0px', right: '0px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '50px' }}>
			<div style={{ backgroundColor: '#ffffff', borderRadius: '4px', margin: '0px', padding: '30px' }}>
				<WalletSelector errorHandler={model.errorHandler} fetch={model.fetch} jsonRpcEndpoint={model.jsonRpcEndpoint} getGasPrice={model.getGasPrice} walletChanged={walletChanged}/>
				<button onClick={() => setIsModalOpen(false)}>Close</button>
			</div>
		</div>}
	</>
}
