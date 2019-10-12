import { ErrorHandler } from '../library/error-handler'
import { ProviderAnnouncement } from '../library/types'
import { MyAccount } from './my-account'
import { AssetManager } from './asset-manager'

interface ProviderModel {
	readonly errorHandler: ErrorHandler
	readonly onProviderSelected: (selectedProviderId: string) => void
	readonly executors?: {
		readonly onSendEth: (amount: bigint, destination: bigint) => Promise<void>
		readonly onSendToken: (token: bigint, amount: bigint, destination: bigint) => Promise<void>
	}
	readonly providers: readonly ProviderAnnouncement[]
	readonly selectedProvider: {
		readonly id: string
		readonly wallet?: {
			readonly address: bigint
			getEthBalance: () => Promise<bigint>
			getTokenBalance: (address: bigint) => Promise<bigint>
		}
	}
	readonly tokens: readonly {
		readonly symbol: string
		readonly address: bigint
	}[]
}

const Providers = ({ providers }: {providers: ProviderModel['providers']}) => <>
	{providers.map(provider => <option key={provider.provider_id} value={provider.provider_id}>{provider.friendly_name}</option>)}
</>

export const Provider = (model: ProviderModel) => <div className='provider-container'>
	<select value={(model.selectedProvider && model.selectedProvider.id) || ''} onChange={event => model.onProviderSelected(event.target.value)}>
		<option disabled value=''>Choose...</option>
		<Providers providers={model.providers}/>
	</select>
	{model.selectedProvider.wallet !== undefined && <MyAccount errorHandler={model.errorHandler} getEthBalance={model.selectedProvider.wallet.getEthBalance} getTokenBalance={model.selectedProvider.wallet.getTokenBalance} address={model.selectedProvider.wallet.address} tokens={model.tokens} />}
	{model.executors !== undefined && <AssetManager errorHandler={model.errorHandler} onSendEth={model.executors.onSendEth} onSendToken={model.executors.onSendToken} tokens={model.tokens} />}
</div>
