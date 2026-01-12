import React from 'react';
import { ProxyNode, ProtocolType } from '../types';
import { Server, Globe, Wifi } from 'lucide-react';

interface NodeItemProps {
  node: ProxyNode;
  onRemove: (id: string) => void;
}

const getProtocolColor = (protocol: ProtocolType) => {
  switch (protocol) {
    case ProtocolType.VMESS: return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
    case ProtocolType.VLESS: return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
    case ProtocolType.TROJAN: return 'text-green-400 border-green-400/30 bg-green-400/10';
    case ProtocolType.SHADOWSOCKS: return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
    case ProtocolType.HYSTERIA:
    case ProtocolType.HYSTERIA2: return 'text-pink-400 border-pink-400/30 bg-pink-400/10';
    case ProtocolType.TUIC: return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';
    default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10';
  }
};

export const NodeItem: React.FC<NodeItemProps> = ({ node, onRemove }) => {
  return (
    <div className="relative group p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-500 transition-all duration-200">
      <div className="flex justify-between items-start mb-2">
        <div className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${getProtocolColor(node.protocol)}`}>
          {node.protocol.toUpperCase()}
        </div>
        <button 
          onClick={() => onRemove(node.id)}
          className="text-gray-500 hover:text-red-400 transition-colors"
          title="删除节点"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-gray-200 font-medium truncate">
          <Server size={14} className="text-gray-400" />
          <span className="truncate" title={node.name}>{node.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 truncate">
          <Globe size={14} />
          <span className="truncate">{node.address}:{node.port}</span>
        </div>
        {node.network && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Wifi size={12} />
            <span>{node.network.toUpperCase()} {node.tls ? '+ TLS' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
};