An SDK for communicating between Ethereum dapps and Ethereum enabled browsers via events.

# Playing Around With It
### Build the SDK
```
cd ethereum-browser-sdk/library
npm install
npm run build
```
### Build the Browser Extension (it uses the SDK as a provider)
```
cd browser-extension
npm install
npm run build
```
### Run the iframe provider static file server (it uses the SDK as a provider)
```
cd provider-iframe-wrapper
npm install
npm run build
npm run serve
```
### Run the dapp (it uses the SDK as a client)
```
cd sample-dapp
npm install
npm run build
npm run serve
```
### Play around with the iFrame Provider
Navigate to http://localhost:49304.  This will open the iframe host which will then load the sample dapp from http://localhost:62091 into an iframe in the page.  The contents of the iframe are sandboxed, and the iframe host communicates with the dapp via events using the protocol defined in this project.  One can imagine a user opening up some page that just has a mnemonic entry box and a URL bar in the middle of it.  You put in your mnemonic and then some dapp you want to use (e.g., augur.casino) and you will be able to use that dapp with your keys secured by the browser's sandboxing of iframes and all without installing any extensions.

### Play Around with the Extension Provider
You can load the browser extension into your browser via the manifest.json in `browser-extension/output/` (how you do this varies by browser).  Then navigate to http://localhost:62091.  Once the dapp is loaded, click the browser extension to have it "connect" with the page.  The functionality here is similar to using MetaMask, where the dapp communicates with a browser plugin.  One notable difference is that the user had to click on the extension icon to "activate" the dapp for that page.  From a security/privacy standpoint this has some nice benefits as it means that the extension needs almost no permissions (unlike MetaMask currently) and the page cannot fingerprint the user by the presense of an extension.

### Play with both at the same time!
If you load the extension and then navigate to the iframe host, then activate the extension, you'll notice that the dapp sees both providers!  The dapp has a very simple interface for choosing the provider they want to interact with, which lets the user use different providers in different contexts.  Maybe the user has some browser extension that auto-connects with every page and has limited funds which they use as their hot wallet while browsing the web.  They may have a separate plugin that is backed by a hardware wallet and requires a click to inject into the page.  The user could browse the web normally with their hot wallet, but then when they need to access larger sums they can just flip the dapp over to their cold storage plugin with a couple clicks.
