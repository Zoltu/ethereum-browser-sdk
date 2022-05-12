import { ErrorHandler } from '../library/error-handler';
import { ProviderAnnouncement } from '../library/types';
import { Provider } from './provider';

export interface AppModel {
	readonly errorHandler: ErrorHandler
	readonly onProviderSelected: (selectedProviderId: string) => void
	executors?: {
		readonly onSendEth: (amount: bigint, destination: bigint) => Promise<void>
		readonly onSendToken: (token: bigint, amount: bigint, destination: bigint) => Promise<void>
	}
	readonly providers: ProviderAnnouncement[]
	selectedProvider: {
		readonly id: string
		wallet?: {
			readonly address: bigint
			readonly getEthBalance: () => Promise<bigint>
			readonly getTokenBalance: (address: bigint) => Promise<bigint>
		}
	}
	readonly tokens: {
		readonly symbol: string
		readonly address: bigint
		readonly decimals: bigint
	}[]
}

// at the moment RootModel exactly matches ProviderModel, but at some point that may change and we'll need to pass individual properties through
export const App = (model: AppModel) => <Provider {...model} />
