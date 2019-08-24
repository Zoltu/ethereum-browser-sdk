import { Address } from '@zoltu/ethereum-types';
import { ErrorHandler } from '../library/error-handler';
import { ProviderAnnouncement } from '../library/types';
import { Provider } from './provider';

export interface AppModel {
	readonly errorHandler: ErrorHandler
	readonly onProviderSelected: (selectedProviderId: string) => void
	executors?: {
		readonly onSendEth: (amount: bigint, destination: Address) => Promise<void>
		readonly onSendToken: (token: Address, amount: bigint, destination: Address) => Promise<void>
	}
	readonly providers: ProviderAnnouncement[]
	selectedProviderId: string
	wallet?: {
		readonly address: Address
		readonly getEthBalance: () => Promise<bigint>
		readonly getTokenBalance: (address: Address) => Promise<bigint>
	}
	readonly tokens: {
		readonly symbol: string
		readonly address: Address
	}[]
}

// at the moment RootModel exactly matches ProviderModel, but at some point that may change and we'll need to pass individual properties through
export const App = (model: AppModel) => <Provider {...model} />
