declare module '@react-native-community/netinfo' {
  export type NetInfoState = {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
  };
  export function fetch(): Promise<NetInfoState>;
  export function addEventListener(listener: (state: NetInfoState) => void): () => void;
}
