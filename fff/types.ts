export enum ProtocolType {
  VMESS = 'vmess',
  VLESS = 'vless',
  TROJAN = 'trojan',
  SHADOWSOCKS = 'ss',
  SOCKS5 = 'socks5',
  HYSTERIA = 'hysteria',
  HYSTERIA2 = 'hysteria2',
  TUIC = 'tuic',
  UNKNOWN = 'unknown'
}

export interface ProxyNode {
  id: string;
  originalLink: string;
  protocol: ProtocolType;
  name: string;
  address: string;
  port: number;
  uuid?: string; // For vmess, vless, trojan
  password?: string; // For ss, socks5, trojan
  encryption?: string; // For ss
  network?: string; // ws, tcp, grpc, etc.
  path?: string;
  host?: string;
  tls?: boolean;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  message: string;
  error?: string;
}