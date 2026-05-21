import React, { useMemo } from 'react';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';

const toWdkNetworks = (chains) => {
  return Object.fromEntries(
    Object.entries(chains).map(([networkName, chainConfig]) => {
      const { blockchain = networkName, ...config } = chainConfig;
      return [
        networkName,
        {
          blockchain,
          config,
        },
      ];
    })
  );
};

export function WalletProvider({ config, bundle, children }) {
  const wdkConfigs = useMemo(() => {
    return {
      networks: toWdkNetworks(config?.chains || {}),
    };
  }, [config?.chains]);

  return (
    <WdkAppProvider bundle={bundle} wdkConfigs={wdkConfigs}>
      {children}
    </WdkAppProvider>
  );
}