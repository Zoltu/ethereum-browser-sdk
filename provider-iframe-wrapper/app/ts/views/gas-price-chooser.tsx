import { bigintToDecimalString } from '../library/utils'

interface GasPriceChooserModel {
	setGasPrice: (value: bigint) => void
}

export function GasPriceChooser(model: GasPriceChooserModel) {
	const [percentile, setPercentile] = React.useState(50)
	const [percentiles, setPercentiles] = React.useState([5n,10n,15n,20n,25n,30n,35n,40n,45n,50n,55n,60n,65n,70n,75n,80n,85n,90n,95n] as Percentiles)

	async function refreshPercentiles() {
		try {
			const result = await fetch('https://gas-oracle.zoltu.io/')
			const json = await result.json()
			const newPercentiles = [] as unknown as Percentiles
			for (let i = 5; i < 100; i += 5) {
				const key= `percentile_${i}`
				if (!(key in json)) throw new Error(`${key} was not found in response: ${JSON.stringify(json)}`)
				const valueString = json[key]
				const match = /^(\d+(?:\.\d+)?) nanoeth$/.exec(valueString)
				if (match === null) throw new Error(`${valueString} is not an integer.`)
				const value = BigInt(Math.round(Number.parseFloat(match[1]) * 10**9))
				newPercentiles[i / 5 - 1] = value - value % 10n**7n
			}
			setPercentiles(newPercentiles)
			model.setGasPrice(percentiles[percentile / 5 -1])
		} catch (error) {
			console.error(error)
		}
	}

	function onChange(percentile: number) {
		if (!Number.isSafeInteger(percentile)) return
		if (percentile < 5) return
		if (percentile > 95) return
		if (percentile % 5) return
		setPercentile(percentile)
		model.setGasPrice(percentiles[percentile / 5 - 1])
	}

	React.useEffect(() => { refreshPercentiles() }, [])

	return <div style={{ display: 'flex', flexDirection: 'row' }}>
		<input type='range' step='5' min='5' max='95' value={percentile} onChange={event => onChange(event.target.valueAsNumber)}/>
		<div>{percentile}th percentile: {bigintToDecimalString(percentiles[percentile / 5 - 1], 9n)} nanoeth</div>
		<button onClick={refreshPercentiles}>↻</button>
	</div>
}

type Percentiles = [bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint]
