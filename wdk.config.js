module.exports = {
  networks: {
    ethereum: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    arbitrum: { package: '@tetherto/wdk-wallet-evm-erc-4337' },
    polygon: { package: '@tetherto/wdk-wallet-evm-erc-4337' }
  },
  output: {
    bundle: './.wdk-bundle/wdk-worklet.bundle.js',
    types: './.wdk/index.d.ts'
  },
  options: {
    targets: ['ios-arm64','ios-arm64-simulator','ios-x64-simulator','android-arm64','android-arm','android-arm64','android-ia32','android-x64']
  }
};
