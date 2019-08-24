import { Address } from '@zoltu/ethereum-types'
import { ErrorHandler } from '../library/error-handler'
import { ProviderAnnouncement } from '../library/types'
import { MyAccount } from './my-account'
import { AssetManager } from './asset-manager'

interface ProviderModel {
	readonly errorHandler: ErrorHandler
	readonly onProviderSelected: (selectedProviderId: string) => void
	readonly executors?: {
		readonly onSendEth: (amount: bigint, destination: Address) => Promise<void>
		readonly onSendToken: (token: Address, amount: bigint, destination: Address) => Promise<void>
	}
	readonly providers: readonly ProviderAnnouncement[]
	readonly selectedProviderId: string
	readonly wallet?: {
		readonly address: Address
		getEthBalance: () => Promise<bigint>
		getTokenBalance: (address: Address) => Promise<bigint>
	}
	readonly tokens: readonly {
		readonly symbol: string
		readonly address: Address
	}[]
}

const Providers = ({ providers }: {providers: ProviderModel['providers']}) => <>
	{providers.map(provider => <option key={provider.provider_id} value={provider.provider_id}>{provider.friendly_name}</option>)}
</>

export const Provider = (model: ProviderModel) => <div className='provider-container'>
	<select value={model.selectedProviderId} onChange={event => model.onProviderSelected(event.target.value)}>
		<option disabled value=''>Choose...</option>
		<Providers providers={model.providers}/>
	</select>
	{model.wallet !== undefined && <MyAccount errorHandler={model.errorHandler} getEthBalance={model.wallet.getEthBalance} getTokenBalance={model.wallet.getTokenBalance} address={model.wallet.address} tokens={model.tokens} />}
	{model.executors !== undefined && <AssetManager errorHandler={model.errorHandler} onSendEth={model.executors.onSendEth} onSendToken={model.executors.onSendToken} tokens={model.tokens} />}
</div>
