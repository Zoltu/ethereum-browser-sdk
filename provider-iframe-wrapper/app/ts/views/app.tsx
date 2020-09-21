import { ErrorHandler } from '../library/error-handler'
import { Wallet } from '../library/wallet'
import { DappSelector } from './dapp-selector'
import { IFrame } from './iframe'
import { WalletSelectorModal } from './wallet-selector-modal'
import { GasPriceChooser } from './gas-price-chooser'
import { Signer, SignerModel } from './signer'

export interface AppModel {
	readonly errorHandler: ErrorHandler
	readonly jsonRpcEndpoint: string
	readonly fetch: Window['fetch']
	readonly childWindowChanged: (window: Window|null) => void
	readonly walletChanged: (wallet: Wallet|undefined) => void
	readonly setGasPrice: (value: bigint) => void
	readonly getGasPrice: () => Promise<bigint>
	wallet: Wallet | undefined
	signerDetails?: SignerModel['details']
	// used when instantiating to prevent certain properties from being watched for changes
	noProxy: Set<string>
}
export const App = (model: AppModel) => {
	const [collapsed, setCollapsed] = React.useState(false)
	const [dappAddress, setDappAddress] = React.useState('http://127.0.0.1:62091')
	const onNavigate = (url: string) => {
		if (url === dappAddress) {
			// refresh
			setDappAddress('')
			// for some reason Chrome chokes if you switch too quickly
			setTimeout(() => setDappAddress(url), 100)
		} else {
			setDappAddress(url)
		}
	}
	return <>
		{ !collapsed && <aside data-bind='hidden: collapse'>
			<DappSelector navigate={onNavigate} dappAddress={dappAddress}/>
			<WalletSelectorModal errorHandler={model.errorHandler} fetch={model.fetch} jsonRpcEndpoint={model.jsonRpcEndpoint} getGasPrice={model.getGasPrice} walletChanged={model.walletChanged} wallet={model.wallet}/>
			<GasPriceChooser setGasPrice={model.setGasPrice}/>
		</aside>}
		{model.signerDetails && <Signer style={{ position: 'absolute', right:'0px' }} errorHandler={model.errorHandler} details={model.signerDetails}/>}
		{ collapsed && <button onClick={() => setCollapsed(false)}>Show Wallet Details</button>}
		{ !collapsed && <button onClick={() => setCollapsed(true)}>Hide Wallet Details</button>}
		<IFrame childWindowChanged={model.childWindowChanged} dappAddress={dappAddress}/>
	</>
}
