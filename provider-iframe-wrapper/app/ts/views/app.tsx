import { ErrorHandler } from '../library/error-handler'
import { Wallet } from '../library/wallet'
import { DappSelector } from './dapp-selector'
import { WalletCreator } from './wallet-creator'
import { IFrame } from './iframe'

export interface AppModel {
	readonly errorHandler: ErrorHandler
	readonly childWindowChanged: (window: Window|null) => void
	readonly walletChanged: (wallet: Wallet|undefined) => void
	wallet: Wallet | undefined
}
export const App = (model: AppModel) => {
	const [collapsed, setCollapsed] = React.useState(false)
	const [dappAddress, setDappAddress] = React.useState<string>('http://127.0.0.1:62091')
	const onNavigate = (url: string) => {
		setDappAddress('')
		setTimeout(() => {
			setDappAddress(url)
		})
	}
	return <>
		{ !collapsed && <aside data-bind='hidden: collapse'>
			<DappSelector navigate={onNavigate} dappAddress={dappAddress}/>
			<WalletCreator errorHandler={model.errorHandler} walletChanged={model.walletChanged} address={model.wallet === undefined ? undefined : model.wallet.ethereumAddress}/>
		</aside>}
		{ collapsed && <button onClick={() => setCollapsed(false)}>Show Wallet Details</button>}
		{ !collapsed && <button onClick={() => setCollapsed(true)}>Hide Wallet Details</button>}
		<IFrame childWindowChanged={model.childWindowChanged} dappAddress={dappAddress}/>
	</>
}
