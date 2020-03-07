import { ErrorHandler } from '../library/error-handler'
import { bigintToDecimalString } from '../library/utils'

interface TokenModel {
	readonly errorHandler: ErrorHandler
	readonly getTokenBalance: () => Promise<bigint>
	readonly symbol: string
	readonly decimals: bigint
}

export const Token = (model: TokenModel) => {
	const [balance, setBalance] = React.useState('Loading...')
	const refreshBalance = async () => setBalance(bigintToDecimalString(await model.getTokenBalance(), model.decimals))
	React.useEffect(model.errorHandler.asyncWrapper(refreshBalance), [model.getTokenBalance])
	return <div className='token'>
		<h3>{model.symbol} Balance</h3>
		<span>{balance}</span>
	</div>
}

interface TokensModel {
	readonly erroHandler: ErrorHandler
	readonly getTokenBalance: (address: bigint) => Promise<bigint>
	readonly tokens: readonly {
		symbol: string
		address: bigint
		decimals: bigint
	}[]
}
export const Tokens = (model: TokensModel) => <div className='tokens'>
	{model.tokens.map(token => <Token key={token.symbol} symbol={token.symbol} errorHandler={model.erroHandler} getTokenBalance={async () => await model.getTokenBalance(token.address)} decimals={token.decimals} />)}
</div>
