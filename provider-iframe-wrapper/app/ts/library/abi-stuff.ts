import { shared } from '@zoltu/ethereum-browser-sdk'
import { Encodable, EncodableTuple, parseSignature, encodeParameters } from '@zoltu/ethereum-abi-encoder'
import { ethereum } from '@zoltu/ethereum-crypto'

// https://github.com/Microsoft/TypeScript/issues/17002
declare global {
	interface ArrayConstructor {
		isArray(arg: ReadonlyArray<any> | any): arg is ReadonlyArray<any>
	}
}

export async function constructorDataBytes(constructorSignature: string, constructorParameters: ReadonlyArray<Encodable>, deploymentBytecode: Iterable<number>): Promise<Uint8Array> {
	const parsedSignature = parseSignature(constructorSignature)
	const encodedParameters = encodeParameters(parsedSignature.inputs, constructorParameters)
	return new Uint8Array([...deploymentBytecode, ...encodedParameters])
}

export function contractParametersToEncodables(contractParameters: shared.ContractParameterArray): ReadonlyArray<Encodable> {
	return contractParameters.map(contractParameterToEncodable)
}

function contractParameterToEncodable(contractParameter: shared.ContractParameter): Encodable {
	if (Array.isArray(contractParameter)) {
		return contractParametersToEncodables(contractParameter)
	} else if (typeof contractParameter === 'object' && !(contractParameter instanceof Uint8Array) && !Array.isArray(contractParameter)) {
		let encodableTuple: EncodableTuple = {}
		for (const propertyKey in contractParameter) {
			encodableTuple[propertyKey] = contractParameterToEncodable(contractParameter[propertyKey])
		}
		return encodableTuple
	} else if (typeof contractParameter === 'number') {
		return BigInt(contractParameter)
	} else {
		return contractParameter
	}
}

export async function bigintToAddressString(value: bigint): Promise<string> {
	return await ethereum.addressToChecksummedString(value)
}
