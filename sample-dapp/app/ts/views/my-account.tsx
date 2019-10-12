import { ErrorHandler } from '../library/error-handler'
import { Tokens, Token } from './token'

interface MyAccountModel {
	errorHandler: ErrorHandler
	getEthBalance: () => Promise<bigint>
	getTokenBalance: (address: bigint) => Promise<bigint>
	readonly address: bigint
	readonly tokens: readonly {
		readonly symbol: string
		readonly address: bigint
	}[]
}

export const MyAccount = (model: MyAccountModel) => <article>
	<h1>My Account</h1>
	<section>
		<h3>Address</h3>
		<span className='monospace'>{model.address.toString(16).padStart(40, '0')}</span>
		<Token errorHandler={model.errorHandler} symbol='ETH' getTokenBalance={model.getEthBalance}  />
		<Tokens erroHandler={model.errorHandler} getTokenBalance={model.getTokenBalance} tokens={model.tokens} />
	</section>
</article>
