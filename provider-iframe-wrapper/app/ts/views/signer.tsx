import { ethereum } from '@zoltu/ethereum-crypto'
import { shared } from '@zoltu/ethereum-browser-sdk'
import { ErrorHandler } from '../library/error-handler'
import { assertNever, bigintToDecimalString } from '../library/utils'
import { Bytes } from '@zoltu/ethereum-types'
import { ParameterDescription, parseSignature } from '@zoltu/ethereum-abi-encoder'

const sharedStyle: React.CSSProperties = {
	position: 'absolute',
	right: '0px',
	background: 'white',
	borderRadius: '5px',
	borderColor: 'black',
	borderStyle: 'solid',
	margin: '5px',
	overflowWrap: 'anywhere',
}

export interface SignerModel {
	readonly style?: React.CSSProperties
	readonly errorHandler: ErrorHandler
	readonly details: {
		readonly kind: 'call'
		readonly action: () => void
		readonly cancel: () => void
		readonly contractAddress: bigint
		readonly methodSignature: string
		readonly methodParameters: readonly shared.ContractParameter[]
		readonly amount: bigint
		readonly gasPrice?: bigint
		readonly gasLimit?: bigint
	} | {
		readonly kind: 'deploy'
		readonly action: () => void
		readonly cancel: () => void
		readonly amount: bigint
		readonly gasPrice?: bigint
		readonly gasLimit?: bigint
	} | {
		readonly kind: 'transfer'
		readonly action: () => void
		readonly cancel: () => void
		readonly destination: bigint
		readonly amount: bigint
		readonly gasPrice?: bigint
		readonly gasLimit?: bigint
	}
}
export function Signer(model: SignerModel) {
	switch (model.details.kind) {
		case 'call': return <ContractCallSigner errorHandler={model.errorHandler} action={model.details.action} cancel={model.details.cancel} contractAddress={model.details.contractAddress} methodSignature={model.details.methodSignature} methodParameters={model.details.methodParameters} amount={model.details.amount} gasPrice={model.details.gasPrice} gasLimit={model.details.gasLimit} />
		case 'deploy': return <ContractDeploySigner action={model.details.action} cancel={model.details.cancel} amount={model.details.amount} gasPrice={model.details.gasPrice} gasLimit={model.details.gasLimit} />
		case 'transfer': return <NativeTransferSigner errorHandler={model.errorHandler} action={model.details.action} cancel={model.details.cancel} destinationAddress={model.details.destination} amount={model.details.amount} gasPrice={model.details.gasPrice} gasLimit={model.details.gasLimit} />
		default: assertNever(model.details)
	}
}

export interface ContractCallSignerModel {
	readonly errorHandler: ErrorHandler
	readonly action: () => void
	readonly cancel: () => void
	readonly contractAddress: bigint
	readonly methodSignature: string
	readonly methodParameters: readonly shared.ContractParameter[]
	readonly amount: bigint
	readonly gasPrice?: bigint
	readonly gasLimit?: bigint
}
export function ContractCallSigner(model: ContractCallSignerModel) {
	const [contractAddressString, setContractAddressString] = React.useState<string | undefined>()
	React.useEffect(model.errorHandler.asyncWrapper(async () => {
		setContractAddressString(await ethereum.addressToChecksummedString(model.contractAddress))
	}), [model.contractAddress])
	const parameterDescriptions = parseSignature(model.methodSignature).inputs

	return <div style={sharedStyle}>
		<div>Contract: <code>{contractAddressString === undefined ? 'Loading...' : contractAddressString}</code></div>
		<div>Signature: <code>{model.methodSignature}</code></div>
		<div>
			Parameters:
			{model.methodParameters.map((value, index) => <div key={index}><Parameter errorHandler={model.errorHandler} description={parameterDescriptions[index]} parameter={value}/></div>)}
		</div>
		<div>Amount: <code>{bigintToDecimalString(model.amount, 18n)}</code></div>
		<div>Gas Price: {model.gasPrice && <code>{bigintToDecimalString(model.gasPrice, 9n)}</code>}</div>
		<div>Gas Limit: {model.gasLimit && <code>{model.gasLimit.toString(10)}</code>}</div>
		<div>
			<button onClick={model.action}>Approve</button>
			<button onClick={model.cancel}>Cancel</button>
		</div>
	</div>
}

export interface ContractDeploySignerModel {
	readonly action: () => void
	readonly cancel: () => void
	readonly amount: bigint
	readonly gasPrice?: bigint
	readonly gasLimit?: bigint
}
export function ContractDeploySigner(model: ContractDeploySignerModel) {
	return <div style={sharedStyle}>
		<div>Contract Deployment</div>
		<div>Amount: <code>{bigintToDecimalString(model.amount, 18n)}</code></div>
		<div>Gas Price: {model.gasPrice && <code>{bigintToDecimalString(model.gasPrice, 9n)}</code>}</div>
		<div>Gas Limit: {model.gasLimit && <code>{model.gasLimit.toString(10)}</code>}</div>
		<div>
			<button onClick={model.action}>Approve</button>
			<button onClick={model.cancel}>Cancel</button>
		</div>
	</div>
}

export interface NativeTransferSignerModel {
	readonly errorHandler: ErrorHandler
	readonly action: () => void
	readonly cancel: () => void
	readonly destinationAddress: bigint
	readonly amount: bigint
	readonly gasPrice?: bigint
	readonly gasLimit?: bigint
}
export function NativeTransferSigner(model: NativeTransferSignerModel) {
	const [destinationAddressString, setDestinationAddress] = React.useState<string | undefined>()
	React.useEffect(model.errorHandler.asyncWrapper(async () => {
		setDestinationAddress(await ethereum.addressToChecksummedString(model.destinationAddress))
	}), [model.destinationAddress])

	return <div style={sharedStyle}>
		<div>Destination: <code>{destinationAddressString === undefined ? 'Loading...' : destinationAddressString}</code></div>
		<div>Amount: <code>{bigintToDecimalString(model.amount, 18n)}</code></div>
		<div>Gas Price: {model.gasPrice && <code>{bigintToDecimalString(model.gasPrice, 9n)}</code>}</div>
		<div>Gas Limit: {model.gasLimit && <code>{model.gasLimit.toString(10)}</code>}</div>
		<div>
			<button onClick={model.action}>Approve</button>
			<button onClick={model.cancel}>Cancel</button>
		</div>
	</div>
}

interface ParameterModel {
	readonly errorHandler: ErrorHandler
	description: ParameterDescription
	parameter: shared.ContractParameter
}
function Parameter({errorHandler, description, parameter}: ParameterModel) {
	if (typeof parameter === 'bigint') {
		if (description.type.includes('int')) {
			return <code>{description.type}: {bigintToDecimalString(parameter, 18n)}</code>
		} else if(description.type === 'address') {
			const [addressString, setAddressString] = React.useState<string | undefined>()
			React.useEffect(errorHandler.asyncWrapper(async () => { setAddressString(await ethereum.addressToChecksummedString(parameter)) }), [parameter])
			return <code>{description.type}: 0x{addressString}</code>
		} else if (description.type.startsWith('bytes')) {
			const length = Number.parseInt(description.type.substring('bytes'.length))
			return <code>{description.type}: 0x{Bytes.fromUnsignedInteger(parameter, length * 8)}</code>
		} else {
			return <code>{description.type}: {parameter.toString()}</code>
		}
	} else if (typeof parameter === 'string') {
		return <code>{description.type}: {parameter}</code>
	} else if (typeof parameter === 'boolean') {
		return <code>{description.type}: {parameter ? 'true' : 'false'}</code>
	} else if (Array.isArray(parameter)) {
		return <div>
			<div>[</div>
				{parameter.map((nestedParameter, index) => <div style={{ marginLeft: '10px' }} key={index}><Parameter errorHandler={errorHandler} description={{ name: `${description.name}_${index}`, type: description.type.slice(0, -2), components: description.components }} parameter={nestedParameter}/></div>)}
			<div>]</div>
		</div>
	} else if (parameter instanceof Uint8Array) {
		return <code>{description.type}: {Bytes.fromByteArray(parameter).to0xString()}</code>
	} else if (typeof parameter === 'object') {
		return <ul>{Object.entries(parameter).map(([key, nestedParameter]) => {
			const components = description.components
			if (components === undefined) throw new Error(`Unexpected tuple in parameters.`)
			const component = components.find(component => component.name === key)
			if (component === undefined) throw new Error(`Unexpected item in tuple.`)
			return <li key={key}><Parameter errorHandler={errorHandler} description={component} parameter={nestedParameter}/></li>
		})}</ul>
	} else {
		assertNever(parameter)
	}
}
