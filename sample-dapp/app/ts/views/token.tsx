import { ErrorHandler } from '../library/error-handler'
import { bigintEthToDecimalString } from '../library/utils'

interface TokenModel {
	readonly errorHandler: ErrorHandler
	readonly getTokenBalance: () => Promise<bigint>
	readonly symbol: string
}

export const Token = (model: TokenModel) => {
	const [balance, setBalance] = React.useState('Loading...')
	const refreshBalance = async () => setBalance(bigintEthToDecimalString(await model.getTokenBalance()))
	React.useEffect(model.errorHandler.asyncWrapper(refreshBalance), [])
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
	}[]
}
export const Tokens = (model: TokensModel) => <div className='tokens'>
	{model.tokens.map(token => <Token key={token.symbol} symbol={token.symbol} errorHandler={model.erroHandler} getTokenBalance={async () => await model.getTokenBalance(token.address)} />)}
</div>
