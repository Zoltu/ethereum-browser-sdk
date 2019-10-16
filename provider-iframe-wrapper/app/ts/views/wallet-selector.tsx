import { ErrorHandler } from '../library/error-handler';
import { Wallet } from '../library/wallet';
import { ViewingWalletInput } from './viewing-wallet-input';
import { MnemonicWalletInput } from './mnemonic-wallet-input';
import { RecoverableWalletInput } from './recoverable-wallet-input';
import { LedgerWalletInput } from './ledger-wallet-input';

export interface WalletSelectorModel {
	readonly errorHandler: ErrorHandler
	readonly jsonRpcEndpoint: string
	readonly fetch: Window['fetch']
	readonly getGasPrice: () => Promise<bigint>
	readonly walletChanged: (wallet: Wallet|undefined) => void
}
export function WalletSelector(model: WalletSelectorModel) {
	const [walletType, setWalletType] = React.useState<'viewing'|'viewing-recoverable'|'mnemonic'|'recoverable'|'ledger'|undefined>(undefined)
	const WalletSwitch = () => {
		switch (walletType) {
			case 'viewing': return <ViewingWalletInput errorHandler={model.errorHandler} jsonRpcEndpoint={model.jsonRpcEndpoint} fetch={model.fetch} getGasPrice={model.getGasPrice} walletChanged={model.walletChanged}/>
			case 'mnemonic': return <MnemonicWalletInput errorHandler={model.errorHandler} jsonRpcEndpoint={model.jsonRpcEndpoint} fetch={model.fetch} getGasPrice={model.getGasPrice} walletChanged={model.walletChanged}/>
			case 'ledger': return <LedgerWalletInput errorHandler={model.errorHandler} jsonRpcEndpoint={model.jsonRpcEndpoint} fetch={model.fetch} getGasPrice={model.getGasPrice} walletChanged={model.walletChanged}/>
			case 'recoverable': return <RecoverableWalletInput errorHandler={model.errorHandler} jsonRpcEndpoint={model.jsonRpcEndpoint} fetch={model.fetch} getGasPrice={model.getGasPrice} walletChanged={model.walletChanged}/>
			case undefined:
			default: return undefined
		}
	}
	return <>
			{walletType === undefined && <div>
				<button onClick={() => setWalletType('viewing')}>Viewing Wallet</button>
				<button onClick={() => setWalletType('mnemonic')}>Mnemonic Word Wallet</button>
				<button onClick={() => setWalletType('recoverable')}>Recoverable Wallet</button>
				<button onClick={() => setWalletType('ledger')}>Ledger Hardware Wallet</button>
			</div>}
			{WalletSwitch()}
			{walletType !== undefined && <button onClick={() => setWalletType(undefined)}>Back</button>}
	</>
}
