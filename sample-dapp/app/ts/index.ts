import { Address, Bytes32 } from '@zoltu/ethereum-types'
import { client } from '@zoltu/ethereum-browser-sdk'
import { ErrorHandler } from './library/error-handler'
import { createOnChangeProxy } from './library/proxy'
import { AppModel, App } from './views/app'

const errorHandler = new ErrorHandler()

/**
 * React Setup
 */

function render() {
	const element = React.createElement(App, rootModel)
	ReactDOM.render(element, main)
}

const rootModel = createOnChangeProxy<AppModel>(render, {
	errorHandler,
	onProviderSelected,
	executors: undefined,
	providers: [],
	selectedProviderId: '',
	wallet: undefined,
	tokens: [
		{ symbol: 'DAI', address: Address.fromUnsignedInteger(0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359n) },
		{ symbol: 'MKR', address: Address.fromUnsignedInteger(0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2n) },
		{ symbol: 'REP', address: Address.fromUnsignedInteger(0x1985365e9f78359a9B6AD760e32412f4a445E862n) },
	]
})
// put the model on the window for debugging convenience
;(window as any).rootModel = rootModel
const main = document.querySelector('main')
render()


/*
 * State Mutators
 */

new client.HandshakeChannel(window, {
	onError: errorHandler.noticeError,
	onProviderAnnounced: (announcement) => {
		if (rootModel.providers.find(provider => provider.provider_id === announcement.provider_id)) return
		rootModel.providers.push(announcement)
	},
})

let previousHotOstrichChannel: client.HotOstrichChannel|undefined = undefined
function onProviderSelected(selectedProviderId: string): void {
	rootModel.selectedProviderId = selectedProviderId

	if (previousHotOstrichChannel !== undefined) previousHotOstrichChannel.shutdown()
	const hotOstrichChannel = previousHotOstrichChannel = new client.HotOstrichChannel(window, selectedProviderId, {
		onError: errorHandler.noticeError,
		onCapabilitiesChanged: () => {
			rootModel.executors = (hotOstrichChannel.capabilities.has('sign') && hotOstrichChannel.capabilities.has('submit'))
				? {
					onSendEth: async (amount: bigint, destination: Address) => {
						await hotOstrichChannel.submitNativeTokenTransfer({ to: destination, value: amount })
					},
					onSendToken: async (address: Address, amount: bigint, destination: Address) => {
						await hotOstrichChannel.submitContractCall({
							contract_address: address,
							method_signature: 'transfer(address destination, uint256 amount)',
							method_parameters: [ destination, amount ],
							value: 0n,
							presentation_dsls: { }
						})
					},
				}
				: undefined
		},
		onWalletAddressChanged: () => {
			// capture the walletAddress object because we will be executing some async code and we don't want to accidentally use the wrong wallet address if it changes
			const walletAddress = hotOstrichChannel.walletAddress
			rootModel.wallet = walletAddress === undefined
				? undefined
				: {
					getEthBalance: async () => {
						return await hotOstrichChannel.getBalance(walletAddress)
					},
					getTokenBalance: async (address: Address) => {
						const resultBytes = await hotOstrichChannel.localContractCall({
							contract_address: address,
							method_signature: 'balanceOf(address)',
							method_parameters: [walletAddress],
							value: 0n
						})
						return Bytes32.fromByteArray(resultBytes).toUnsignedBigint()
					},
					address: Address.fromByteArray(walletAddress),
					tokens: rootModel.tokens.map(token => ({ ...token, balance: undefined })),
					ethBalance: undefined,
				} as Exclude<AppModel['wallet'], undefined>
		}
	})
}
