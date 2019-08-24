/**
 * this script executed within the context of the active tab when the user clicks the extension bar button
 * this script serves as a _very thin_ proxy between the page scripts (dapp) and the extension, simply forwarding messages between the two
*/

if (!(window as any).recoverableWalletInjected) {
	(window as any).recoverableWalletInjected = true

	// the content script is a very thin proxy between the background script and the page script
	const extensionPort = browser.runtime.connect()

	// forward all message events to the background script, which will then filter and process them
	window.addEventListener('message', messageEvent => {
		try {
			// we only want the data element, if it exists, and postMessage will fail if it can't clone the object fully (and it cannot clone a MessageEvent)
			if (!('data' in messageEvent)) return
			extensionPort.postMessage({data: messageEvent.data})
		} catch (error) {
			// CONSIDER: should we catch data clone error and then do `extensionPort.postMessage({data:JSON.parse(JSON.stringify(messageEvent.data))})`?
			console.error(error)
		}
	})

	// forward all messages we get from the background script to the window so the page script can filter and process them
	extensionPort.onMessage.addListener(response => {
		try {
			window.postMessage(response, '*')
		} catch (error) {
			console.error(error)
		}
	})

	console.log('content script has been attached')
}
