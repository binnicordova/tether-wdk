export const DEFAULT_NETWORK = 'ethereum';
export const ACTIVE_NETWORKS = ['ethereum', 'arbitrum', 'polygon'];

export const recommendedNetworkSettings = {
  ethereum: {
    chainId: 1,
    blockchain: 'ethereum',
    provider: 'https://eth.merkle.io',
    bundlerUrl: 'https://api.candide.dev/public/v3/ethereum',
    paymasterUrl: 'https://api.candide.dev/public/v3/ethereum',
    paymasterAddress: '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba',
    entrypointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    transferMaxFee: 5000000,
    swapMaxFee: 5000000,
    bridgeMaxFee: 5000000,
    paymasterToken: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
  },
  arbitrum: {
    chainId: 42161,
    blockchain: 'arbitrum',
    provider: 'https://arb1.arbitrum.io/rpc',
    bundlerUrl: 'https://api.candide.dev/public/v3/arbitrum',
    paymasterUrl: 'https://api.candide.dev/public/v3/arbitrum',
    paymasterAddress: '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba',
    entrypointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    transferMaxFee: 5000000,
    swapMaxFee: 5000000,
    bridgeMaxFee: 5000000,
    paymasterToken: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    },
  },
  polygon: {
    chainId: 137,
    blockchain: 'polygon',
    provider: 'https://1rpc.io/matic',
    bundlerUrl: 'https://api.candide.dev/public/v3/polygon',
    paymasterUrl: 'https://api.candide.dev/public/v3/polygon',
    paymasterAddress: '0x8b1f6cb5d062aa2ce8d581942bbb960420d875ba',
    entrypointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    transferMaxFee: 5000000,
    swapMaxFee: 5000000,
    bridgeMaxFee: 5000000,
    paymasterToken: {
      address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    },
    safeModulesVersion: '0.3.0',
  },
  ton: {
    blockchain: 'ton',
    tonApiClient: {
      url: 'https://tonapi.io',
    },
    tonClient: {
      url: 'https://toncenter.com/api/v2/jsonRPC',
    },
    paymasterToken: {
      address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    },
    transferMaxFee: 1000000000,
  },
  bitcoin: {
    blockchain: 'bitcoin',
    host: 'api.ordimint.com',
    port: 50001,
  },
};

const toWdkNetworkConfig = (networkName, settings) => {
  const { blockchain = networkName, ...config } = settings;
  return {
    blockchain,
    config,
  };
};

export const wdkConfigs = {
  networks: Object.fromEntries(
    ACTIVE_NETWORKS.map((networkName) => [
      networkName,
      toWdkNetworkConfig(networkName, recommendedNetworkSettings[networkName]),
    ])
  ),
};

export const getChainsConfig = () => {
  return Object.fromEntries(
    ACTIVE_NETWORKS.map((networkName) => [
      networkName,
      recommendedNetworkSettings[networkName],
    ])
  );
};
