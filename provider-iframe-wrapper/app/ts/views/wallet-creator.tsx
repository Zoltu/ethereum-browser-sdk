import { Address } from '@zoltu/ethereum-types'
import { ErrorHandler } from '../library/error-handler'
import { Wallet } from '../library/wallet'
import { AddressInput } from './address-input'
import { MnemonicInput } from './mnemonic-input'

export interface WalletCreatorModel {
	readonly errorHandler: ErrorHandler
	readonly walletChanged: (wallet: Wallet|undefined) => void
	readonly address: Address | undefined
}
export const WalletCreator = (model: WalletCreatorModel) => {
	const [mnemonicIsEmpty, setMnemonicIsEmpty] = React.useState(true)
	const [addressIsEmpty, setAddressIsEmpty] = React.useState(true)
	return <>
		{(!mnemonicIsEmpty || addressIsEmpty) && <MnemonicInput errorHandler={model.errorHandler} walletChanged={model.walletChanged} emptyStateChanged={setMnemonicIsEmpty}/>}
		{mnemonicIsEmpty && <AddressInput errorHandler={model.errorHandler} walletChanged={model.walletChanged} emptyStateChanged={setAddressIsEmpty}/>}
		{model.address !== undefined && <div><label>Address: </label><label className='monospace'>{model.address.toString()}</label></div>}
	</>
}
