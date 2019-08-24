import { Address } from '@zoltu/ethereum-types'
import { ErrorHandler } from '../library/error-handler'
import { SendTokens } from './send-token'
import { SendEth } from './send-eth'

interface AssetManagerModel {
	readonly errorHandler: ErrorHandler
	readonly onSendEth: (amount: bigint, destination: Address) => Promise<void>
	readonly onSendToken: (token: Address, amount: bigint, destination: Address) => Promise<void>
	readonly tokens: readonly { symbol: string, address: Address }[]
}

export const AssetManager = (model: AssetManagerModel) => {
	return <article>
		<h1>Manage Assets</h1>
		<section>
			<SendEth errorHandler={model.errorHandler} onSendEth={model.onSendEth} />
			<SendTokens errorHandler={model.errorHandler} onSendToken={model.onSendToken} tokens={model.tokens}/>
		</section>
	</article>
}
