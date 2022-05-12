import { client } from '@zoltu/ethereum-browser-sdk'
import { ErrorHandler } from './library/error-handler'
import { createOnChangeProxy } from './library/proxy'
import { AppModel, App } from './views/app'
import { uint8ArrayToUnsignedBigint } from './library/utils'

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
	selectedProvider: {
		id: ''
	},
	tokens: [
		{ symbol: 'DAI', address: 0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359n, decimals: 18n },
		{ symbol: 'MKR', address: 0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2n, decimals: 18n },
		{ symbol: 'REP', address: 0x1985365e9f78359a9B6AD760e32412f4a445E862n, decimals: 18n },
		{ symbol: 'USDC', address: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48n, decimals: 6n },
		{ symbol: 'TOK', address: 0xa15579ce14e99bfb943a76dcc0d818f30cc408adn, decimals: 18n },
	],
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
	rootModel.selectedProvider = { id: selectedProviderId }
	// capture the selectedProvider so we don't accidentally update a new one during a switch
	const selectedProvider = rootModel.selectedProvider

	if (previousHotOstrichChannel !== undefined) previousHotOstrichChannel.shutdown()
	const hotOstrichChannel = previousHotOstrichChannel = new client.HotOstrichChannel(window, selectedProviderId, {
		onError: errorHandler.noticeError,
		onCapabilitiesChanged: () => {
			rootModel.executors = (hotOstrichChannel.capabilities.has('signTransaction') && hotOstrichChannel.capabilities.has('submit'))
				? {
					onSendEth: async (amount: bigint, destination: bigint) => {
						await hotOstrichChannel.submitNativeTokenTransfer({ to: destination, value: amount })
					},
					onSendToken: async (address: bigint, amount: bigint, destination: bigint) => {
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
			const walletAddress = hotOstrichChannel.walletAddress === undefined ? undefined : BigInt(hotOstrichChannel.walletAddress)
			selectedProvider.wallet = walletAddress === undefined
				? undefined
				: {
					getEthBalance: async () => {
						return await hotOstrichChannel.getBalance(walletAddress)
					},
					getTokenBalance: async (address: bigint) => {
						const resultBytes = await hotOstrichChannel.localContractCall({
							contract_address: address,
							method_signature: 'balanceOf(address)',
							method_parameters: [walletAddress],
							value: 0n
						})
						return uint8ArrayToUnsignedBigint(resultBytes)
					},
					address: walletAddress,
				}
		}
	})
}
