import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useAccount,
  useRefreshBalance,
  useWalletManager,
  useWdkApp,
} from '@tetherto/wdk-react-native-core';

import { WalletProvider } from './src/providers/WalletProvider';
import { ACTIVE_NETWORKS, DEFAULT_NETWORK, getChainsConfig } from './src/config/wdk';

const workletBundle = require('./.wdk-bundle/wdk-worklet.bundle.js');
const NETWORK_LABELS = {
  ethereum: 'Ethereum Mainnet',
  arbitrum: 'Arbitrum One',
  polygon: 'Polygon PoS',
  ton: 'TON',
  bitcoin: 'Bitcoin',
};

const NETWORK_CARD_THEME = {
  ethereum: { backgroundColor: '#1573E6', borderColor: '#165FB5', textColor: '#07244D' },
  arbitrum: { backgroundColor: '#1AB6DC', borderColor: '#1997B7', textColor: '#063D4D' },
  polygon: { backgroundColor: '#0EE17C', borderColor: '#07B664', textColor: '#032D22' },
  default: { backgroundColor: '#A3E635', borderColor: '#65A30D', textColor: '#365314' },
};

const SWAP_TOKENS = [
  {
    id: 'usdt',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  {
    id: 'usdc',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
];

const pow10 = (n) => BigInt(10) ** BigInt(n);

const decimalToBaseUnits = (value, decimals) => {
  const normalized = String(value || '').trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Enter a valid numeric amount.');
  }

  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Maximum ${decimals} decimal places supported.`);
  }

  const wholePart = BigInt(whole || '0') * pow10(decimals);
  const fractionPart = BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals));
  return wholePart + fractionPart;
};

const baseUnitsToDecimal = (value, decimals) => {
  const base = typeof value === 'bigint' ? value : BigInt(value || 0);
  const whole = base / pow10(decimals);
  const fraction = (base % pow10(decimals)).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : `${whole}`;
};

export default function App() {
  const walletProviderConfig = {
    indexer: {
      apiKey: process.env.EXPO_PUBLIC_WDK_INDEXER_API_KEY,
      url: process.env.EXPO_PUBLIC_WDK_INDEXER_BASE_URL,
    },
    chains: getChainsConfig(),
    enableCaching: true,
  };

  return (
    <WalletProvider config={walletProviderConfig} bundle={{ bundle: workletBundle }}>
      <SafeAreaView style={styles.safeArea}>
        <WalletScreen />
        <StatusBar style="dark" />
      </SafeAreaView>
    </WalletProvider>
  );
}

function PrimaryButton({ title, onPress, disabled }) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function SecondaryButton({ title, onPress }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

const shortenAddress = (value) => {
  if (!value || value.length < 12) return value || 'Not available';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

function WalletScreen() {
  const { state } = useWdkApp();
  const { createWallet, unlock, lock } = useWalletManager();
  const { mutate: refreshBalance } = useRefreshBalance();
  const { address, extension } = useAccount({ network: DEFAULT_NETWORK, accountIndex: 0 });

  const [swapAmount, setSwapAmount] = useState('10');
  const [tokenInId, setTokenInId] = useState(SWAP_TOKENS[0].id);
  const [tokenOutId, setTokenOutId] = useState(SWAP_TOKENS[1].id);
  const [quoteSummary, setQuoteSummary] = useState('No quote yet.');
  const [swapStatus, setSwapStatus] = useState('Ready to swap.');
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const chainsConfig = getChainsConfig();
  const orderedNetworks = [DEFAULT_NETWORK, ...ACTIVE_NETWORKS.filter((network) => network !== DEFAULT_NETWORK)];
  const stackNetworks = orderedNetworks.slice(0, 3);

  const frontNetworkKey = stackNetworks[0];
  const middleNetworkKey = stackNetworks[1];
  const backNetworkKey = stackNetworks[2];

  const frontTheme = NETWORK_CARD_THEME[frontNetworkKey] || NETWORK_CARD_THEME.default;
  const middleTheme = NETWORK_CARD_THEME[middleNetworkKey] || NETWORK_CARD_THEME.default;
  const backTheme = NETWORK_CARD_THEME[backNetworkKey] || NETWORK_CARD_THEME.default;

  const networkName = NETWORK_LABELS[DEFAULT_NETWORK] || DEFAULT_NETWORK;
  const currentChain = chainsConfig[DEFAULT_NETWORK];
  const currentChainId = currentChain?.chainId || 'N/A';

  const tokenIn = useMemo(() => SWAP_TOKENS.find((token) => token.id === tokenInId), [tokenInId]);
  const tokenOut = useMemo(() => SWAP_TOKENS.find((token) => token.id === tokenOutId), [tokenOutId]);

  const getSwapExtension = () => {
    return extension();
  };

  const buildSwapOptions = () => {
    if (!tokenIn || !tokenOut) {
      throw new Error('Please select both tokens.');
    }
    if (tokenIn.id === tokenOut.id) {
      throw new Error('Token pair must be different.');
    }

    const amountBase = decimalToBaseUnits(swapAmount, tokenIn.decimals);
    const amountNumber = Number(amountBase);
    if (!Number.isSafeInteger(amountNumber) || amountNumber <= 0) {
      throw new Error('Swap amount is too large or invalid.');
    }

    return {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      tokenInAmount: amountNumber,
    };
  };

  const handleQuoteSwap = async () => {
    try {
      setIsQuoting(true);
      const swapOptions = buildSwapOptions();
      const swapExtension = getSwapExtension();
      const quote = await swapExtension.quoteSwap(swapOptions);

      if (!quote) {
        throw new Error('No quote returned by wallet protocol.');
      }

      const tokenInAmount = baseUnitsToDecimal(quote.tokenInAmount, tokenIn.decimals);
      const tokenOutAmount = baseUnitsToDecimal(quote.tokenOutAmount, tokenOut.decimals);
      setQuoteSummary(`${tokenInAmount} ${tokenIn.symbol} -> ${tokenOutAmount} ${tokenOut.symbol}`);
      setSwapStatus('Quote ready. Review and execute swap.');
    } catch (error) {
      const message = error?.message || 'Unable to fetch quote. Ensure swap protocol is configured.';
      setSwapStatus(message);
      setQuoteSummary('No quote available.');
    } finally {
      setIsQuoting(false);
    }
  };

  const handleExecuteSwap = async () => {
    try {
      setIsSwapping(true);
      const swapOptions = buildSwapOptions();
      const swapExtension = getSwapExtension();
      const result = await swapExtension.swap(swapOptions);

      if (!result?.hash) {
        throw new Error('Swap did not return a transaction hash.');
      }

      setSwapStatus(`Swap submitted: ${result.hash.slice(0, 14)}...`);
      Alert.alert('Swap submitted', `Transaction hash: ${result.hash}`);
    } catch (error) {
      const message = error?.message || 'Swap failed. Please try again.';
      setSwapStatus(message);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleRefreshBalances = () => {
    refreshBalance({ accountIndex: 0, type: 'wallet' });
    Alert.alert('Balances refreshed', 'Latest balances are being synced.');
  };

  const handleComingSoon = (feature) => {
    Alert.alert('Coming soon', `${feature} flow is coming in the next iteration.`);
  };

  switch (state.status) {
    case 'INITIALIZING':
    case 'REINITIALIZING':
      return (
        <ScrollView contentContainerStyle={styles.screenContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.appTitle}>Tether Wallet</Text>
            <Text style={styles.appSubtitle}>Secure self-custody wallet</Text>
          </View>

          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#1E3A8A" />
            <Text style={styles.stateTitle}>Preparing your wallet</Text>
            <Text style={styles.stateDescription}>
              Initializing encryption and blockchain services for a secure session.
            </Text>
          </View>
        </ScrollView>
      );
    case 'NO_WALLET':
      return (
        <ScrollView contentContainerStyle={styles.screenContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.appTitle}>Tether Wallet</Text>
            <Text style={styles.appSubtitle}>Secure self-custody wallet</Text>
          </View>

          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Welcome</Text>
            <Text style={styles.stateDescription}>
              Create your first wallet to start managing digital assets across supported networks.
            </Text>
            <PrimaryButton title="Create Wallet" onPress={() => createWallet('my-wallet')} />
          </View>
        </ScrollView>
      );
    case 'LOCKED':
      return (
        <ScrollView contentContainerStyle={styles.screenContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.appTitle}>Tether Wallet</Text>
            <Text style={styles.appSubtitle}>Secure self-custody wallet</Text>
          </View>

          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Wallet is locked</Text>
            <Text style={styles.stateDescription}>
              Unlock to access balances, account actions, and secure transaction signing.
            </Text>
            <PrimaryButton title="Unlock Wallet" onPress={() => unlock()} />
          </View>
        </ScrollView>
      );
    case 'READY':
      return (
        <ScrollView
          contentContainerStyle={styles.screenContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.walletHeaderRow}>
            <Text style={styles.walletHeaderTitle}>Wallet</Text>
            <Text style={styles.walletHeaderCaption}>In-app secure mode</Text>
          </View>

          <View style={styles.walletStackContainer}>
            <View
              style={[
                styles.walletCard,
                styles.walletCardBackA,
                { backgroundColor: backTheme.backgroundColor, borderColor: backTheme.borderColor },
              ]}
            >
              <Text style={[styles.walletCardLabelMuted, { color: backTheme.textColor }]}>
                {NETWORK_LABELS[backNetworkKey] || backNetworkKey}
              </Text>
            </View>

            <View
              style={[
                styles.walletCard,
                styles.walletCardBackB,
                { backgroundColor: middleTheme.backgroundColor, borderColor: middleTheme.borderColor },
              ]}
            >
              <Text style={[styles.walletCardLabelMuted, { color: middleTheme.textColor }]}>
                {NETWORK_LABELS[middleNetworkKey] || middleNetworkKey}
              </Text>
            </View>

            <View
              style={[
                styles.walletCard,
                styles.walletCardFront,
                { backgroundColor: frontTheme.backgroundColor, borderColor: frontTheme.borderColor },
              ]}
            >
              <View style={styles.walletCardTopRow}>
                <View>
                  <Text style={[styles.walletCardBrand, { color: frontTheme.textColor }]}>Tether Wallet</Text>
                  <Text style={[styles.walletCardType, { color: frontTheme.textColor }]}>Credit</Text>
                </View>
                <View style={styles.networkPillLight}>
                  <View style={styles.networkDotDark} />
                  <Text style={styles.networkPillDarkText}>{networkName}</Text>
                </View>
              </View>

              <View style={styles.walletCardBottomRow}>
                <View>
                  <Text style={[styles.walletCardDigits, { color: frontTheme.textColor }]}>
                    {shortenAddress(address)}
                  </Text>
                  <Text style={[styles.walletCardMeta, { color: frontTheme.textColor }]}>Chain ID {currentChainId}</Text>
                </View>
                <Text style={[styles.walletCardSignal, { color: frontTheme.textColor }]}>)))</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}> 
            <SecondaryButton title="Receive" onPress={() => handleComingSoon('Receive')} />
            <SecondaryButton title="Send" onPress={() => handleComingSoon('Send')} />
            <SecondaryButton title="Quote Swap" onPress={handleQuoteSwap} />
          </View>

          <View style={styles.exchangeCard}>
            <View style={styles.exchangeHeaderRow}>
              <Text style={styles.exchangeTitle}>In-App Exchange</Text>
              <Pressable style={styles.refreshButton} onPress={handleRefreshBalances}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </Pressable>
            </View>
            <Text style={styles.exchangeDescription}>
              Swap directly inside your wallet using Tether protocol extensions.
            </Text>

            <View style={styles.swapGrid}>
              <View style={styles.swapInputCard}>
                <Text style={styles.swapLabel}>Amount ({tokenIn?.symbol})</Text>
                <TextInput
                  value={swapAmount}
                  onChangeText={setSwapAmount}
                  keyboardType="decimal-pad"
                  style={styles.swapInput}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.swapInputCard}>
                <Text style={styles.swapLabel}>From</Text>
                <View style={styles.tokenRow}>
                  {SWAP_TOKENS.map((token) => (
                    <Pressable
                      key={token.id}
                      style={[styles.tokenPill, tokenInId === token.id && styles.tokenPillSelected]}
                      onPress={() => setTokenInId(token.id)}
                    >
                      <Text style={[styles.tokenPillText, tokenInId === token.id && styles.tokenPillTextSelected]}>
                        {token.symbol}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.swapInputCard}>
                <Text style={styles.swapLabel}>To</Text>
                <View style={styles.tokenRow}>
                  {SWAP_TOKENS.map((token) => (
                    <Pressable
                      key={token.id}
                      style={[styles.tokenPill, tokenOutId === token.id && styles.tokenPillSelected]}
                      onPress={() => setTokenOutId(token.id)}
                    >
                      <Text style={[styles.tokenPillText, tokenOutId === token.id && styles.tokenPillTextSelected]}>
                        {token.symbol}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.quoteCard}>
              <Text style={styles.quoteLabel}>Quote</Text>
              <Text style={styles.quoteValue} numberOfLines={1} ellipsizeMode="tail">{quoteSummary}</Text>
              <Text style={styles.swapStatus} numberOfLines={2} ellipsizeMode="tail">{swapStatus}</Text>
            </View>

            <View style={styles.swapActionRow}>
              <Pressable
                style={[styles.swapPrimaryButton, (isQuoting || isSwapping) && styles.buttonDisabled]}
                onPress={handleQuoteSwap}
                disabled={isQuoting || isSwapping}
              >
                <Text style={styles.swapPrimaryButtonText}>{isQuoting ? 'Quoting...' : 'Get Quote'}</Text>
              </Pressable>
              <Pressable
                style={[styles.swapSecondaryButton, (isQuoting || isSwapping) && styles.buttonDisabled]}
                onPress={handleExecuteSwap}
                disabled={isQuoting || isSwapping}
              >
                <Text style={styles.swapSecondaryButtonText}>{isSwapping ? 'Swapping...' : 'Swap Now'}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.lockButton} onPress={() => lock()}>
              <Text style={styles.lockButtonText}>Lock Wallet</Text>
            </Pressable>
          </View>

          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>Account Details</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.panelLabel}>Status</Text>
              <Text style={styles.panelValue}>Active</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.panelLabel}>Address</Text>
              <Text style={styles.panelValue} numberOfLines={1} ellipsizeMode="middle">{shortenAddress(address)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.panelLabel}>Network</Text>
              <Text style={styles.panelValue} numberOfLines={1} ellipsizeMode="tail">{networkName}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.panelLabel}>Chain ID</Text>
              <Text style={styles.panelValue}>{String(currentChainId)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.panelLabel}>Configured Networks</Text>
              <Text style={styles.panelValue}>{ACTIVE_NETWORKS.length}</Text>
            </View>
          </View>
        </ScrollView>
      );
    case 'ERROR':
      return (
        <ScrollView contentContainerStyle={styles.screenContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.appTitle}>Tether Wallet</Text>
            <Text style={styles.appSubtitle}>Secure self-custody wallet</Text>
          </View>

          <View style={styles.errorCard}>
            <Text style={styles.stateTitle}>Something went wrong</Text>
            <Text style={styles.errorText}>{state.error.message}</Text>
            <PrimaryButton title="Try Unlock" onPress={() => unlock()} />
          </View>
        </ScrollView>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF2FA',
  },
  screenContainer: {
    flexGrow: 1,
    backgroundColor: '#EEF2FA',
    justifyContent: 'flex-start',
    padding: 24,
    paddingBottom: 36,
    gap: 16,
  },
  headerRow: {
    paddingTop: 6,
    gap: 2,
  },
  walletHeaderRow: {
    paddingTop: 4,
    gap: 2,
  },
  walletHeaderTitle: {
    fontSize: 46,
    fontWeight: '800',
    color: '#020617',
    letterSpacing: -0.8,
  },
  walletHeaderCaption: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  stateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  stateDescription: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  walletStackContainer: {
    marginTop: 4,
    height: 380,
    position: 'relative',
  },
  walletCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 2,
  },
  walletCardBackA: {
    top: 0,
    height: 210,
    backgroundColor: '#1573E6',
    borderColor: '#165FB5',
  },
  walletCardBackB: {
    top: 56,
    height: 210,
    backgroundColor: '#1AB6DC',
    borderColor: '#1997B7',
  },
  walletCardFront: {
    top: 112,
    height: 252,
    backgroundColor: '#0EE17C',
    borderColor: '#07B664',
    padding: 20,
    justifyContent: 'space-between',
  },
  walletCardLabelMuted: {
    paddingTop: 18,
    paddingHorizontal: 20,
    fontSize: 20,
    color: 'rgba(7, 17, 42, 0.68)',
    fontWeight: '600',
  },
  walletCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  walletCardBrand: {
    fontSize: 16,
    color: '#064E3B',
    fontWeight: '700',
  },
  walletCardType: {
    marginTop: 2,
    fontSize: 36,
    letterSpacing: -0.2,
    color: '#032D22',
    fontWeight: '600',
  },
  networkPillLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  networkDotDark: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#065F46',
  },
  networkPillDarkText: {
    color: '#064E3B',
    fontSize: 12,
    fontWeight: '700',
  },
  walletCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  walletCardDigits: {
    fontSize: 32,
    fontWeight: '500',
    letterSpacing: 1.6,
  },
  walletCardMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
  },
  walletCardSignal: {
    fontSize: 36,
    fontWeight: '900',
    transform: [{ rotate: '90deg' }],
    marginBottom: 8,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#1E293B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  networkPillText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 13,
  },
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 12,
  },
  panelTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panelLabel: {
    color: '#64748B',
    fontSize: 14,
  },
  panelValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
  exchangeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E2F3',
    padding: 18,
    gap: 12,
  },
  exchangeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exchangeTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
  },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
  },
  refreshButtonText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },
  exchangeDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  exchangeList: {
    gap: 8,
  },
  swapGrid: {
    gap: 8,
  },
  swapInputCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  swapLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  swapInput: {
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '700',
    paddingVertical: 2,
  },
  tokenRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenPill: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  tokenPillSelected: {
    borderColor: '#1D4ED8',
    backgroundColor: '#DBEAFE',
  },
  tokenPillText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  tokenPillTextSelected: {
    color: '#1E3A8A',
  },
  exchangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exchangeMeta: {
    gap: 2,
    flex: 1,
  },
  exchangeName: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '700',
  },
  exchangeType: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  exchangeNetworks: {
    color: '#64748B',
    fontSize: 12,
  },
  exchangeAction: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  quoteCard: {
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    padding: 12,
    gap: 4,
  },
  quoteLabel: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  quoteValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  swapStatus: {
    color: '#475569',
    fontSize: 12,
  },
  swapActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  swapPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    backgroundColor: '#1D4ED8',
  },
  swapPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  swapSecondaryButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    backgroundColor: '#0F172A',
  },
  swapSecondaryButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  lockButton: {
    marginTop: 2,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  lockButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 20,
    gap: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#9F1239',
    lineHeight: 20,
  },
});
