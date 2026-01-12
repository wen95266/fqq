import { ProxyNode, ProtocolType } from "../types";
import yaml from 'js-yaml';

// 代理池：优先使用稳定性更高的代理
const PROXY_PROVIDERS = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
];

// 并发限制，防止浏览器或代理服务拒绝请求
const CONCURRENCY_LIMIT = 5;

export const fetchAndParseNodes = async (
  urls: string[], 
  onProgress?: (processed: number, total: number, lastMessage: string) => void
): Promise<ProxyNode[]> => {
  // 1. 深度清洗 URL
  const uniqueUrls = [...new Set(
    urls
      .map(u => u.trim())
      .filter(u => u.length > 0 && (u.startsWith('http') || u.includes('://')))
  )];

  const total = uniqueUrls.length;
  let processedCount = 0;
  let allNodes: ProxyNode[] = [];

  // 2. 分批处理 (Batch Processing)
  for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
    const batch = uniqueUrls.slice(i, i + CONCURRENCY_LIMIT);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const result = await processSingleUrl(url);
        processedCount++;
        if (onProgress) {
            const statusMsg = result.length > 0 ? `+${result.length}` : `失败/空`;
            onProgress(processedCount, total, `[${processedCount}/${total}] ${new URL(url).pathname.split('/').slice(-3).join('/')} (${statusMsg})`);
        }
        return result;
      })
    );

    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        allNodes = [...allNodes, ...result.value];
      }
    });
  }

  return allNodes;
};

// 处理单个 URL 的完整流程
const processSingleUrl = async (targetUrl: string): Promise<ProxyNode[]> => {
  let content: string | null = null;

  // 1. 尝试所有代理获取内容
  for (const formatProxy of PROXY_PROVIDERS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

      const proxyUrl = formatProxy(targetUrl);
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        // 宽松验证：只要有内容且不是纯 HTML 错误页即可
        if (text && text.length > 10 && !text.includes('<!DOCTYPE html>') && !text.includes('Error:')) {
          content = text;
          break; // 成功获取，退出代理循环
        }
      }
    } catch (e) {
      continue;
    }
  }

  if (!content) {
    return [];
  }

  // 2. 解析内容
  try {
    const nodes = parseContent(content, targetUrl);
    return nodes;
  } catch (e) {
    console.error(`[Parse Error] ${targetUrl}`, e);
    return [];
  }
};

const parseContent = (text: string, sourceUrl: string): ProxyNode[] => {
  text = text.trim();
  let nodes: ProxyNode[] = [];

  // 策略 A: 结构化解析 (JSON / YAML)
  // 宽松判断，防止文件头有注释导致 parse 失败
  if (text.includes('{') || text.includes('[')) {
    try {
      // 尝试截取第一个 { 或 [ 开始的部分
      const jsonStartIndex = text.search(/[{[]/);
      if (jsonStartIndex >= 0) {
        const jsonText = text.substring(jsonStartIndex);
        const json = JSON.parse(jsonText);
        
        if (Array.isArray(json)) {
          nodes = parseSingbox(json); 
        } else if (json.outbounds) {
          nodes = parseSingbox(json.outbounds);
        } else if (json.proxies) {
          nodes = parseClash(json.proxies);
        } else if (json.server && (json.password || json.auth)) {
          nodes = [parseHysteriaSingle(json)];
        }
      }
    } catch (e) { /* JSON 解析失败 */ }
  } 
  
  // 如果 JSON 解析失败，尝试 YAML
  if (nodes.length === 0) {
    try {
      const yamlObj = yaml.load(text) as any;
      if (yamlObj && yamlObj.proxies && Array.isArray(yamlObj.proxies)) {
        nodes = parseClash(yamlObj.proxies);
      }
    } catch (e) { /* YAML 解析失败 */ }
  }

  // 策略 B: Base64 解码后解析
  if (nodes.length === 0 && !text.includes(' ') && !text.includes('\n')) {
     nodes = parseStandardLinks(text);
  }

  // 策略 C: 暴力正则提取 (兜底方案)
  // 只有当前面策略都失败，或者文本明显是散乱的链接列表时
  if (nodes.length === 0 || text.includes('://')) {
    const regexNodes = extractLinksRegex(text);
    // 合并结果，去重
    regexNodes.forEach(rn => {
        if (!nodes.find(n => n.originalLink === rn.originalLink)) {
            nodes.push(rn);
        }
    });
  }

  return nodes;
};

// --- Parsers ---

const parseSingbox = (list: any[]): ProxyNode[] => {
  const nodes: ProxyNode[] = [];
  if (!Array.isArray(list)) return [];

  list.forEach((ob, idx) => {
    if (!ob || typeof ob !== 'object') return;
    if (['selector', 'urltest', 'direct', 'block', 'dns', 'reject'].includes(ob.type)) return;

    const protocol = mapSingboxTypeToProtocol(ob.type);
    if (protocol === ProtocolType.UNKNOWN) return;

    const node: ProxyNode = {
      id: `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: ob.tag || `${protocol}-${idx}`,
      protocol,
      address: ob.server,
      port: ob.server_port,
      uuid: ob.uuid,
      password: ob.password || ob.auth,
      network: ob.transport?.type || 'tcp',
      tls: ob.tls?.enabled || false,
      host: ob.tls?.server_name || ob.transport?.headers?.Host,
      path: ob.transport?.path,
      originalLink: ''
    };
    
    node.originalLink = constructLink(node);
    if (node.address && node.port) nodes.push(node);
  });

  return nodes;
};

const parseClash = (proxies: any[]): ProxyNode[] => {
  const nodes: ProxyNode[] = [];
  if (!Array.isArray(proxies)) return [];

  proxies.forEach((p, idx) => {
    if (!p || typeof p !== 'object') return;
    
    const protocol = mapClashTypeToProtocol(p.type);
    if (protocol === ProtocolType.UNKNOWN) return;

    const node: ProxyNode = {
      id: `clash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: p.name || `Node-${idx}`,
      protocol,
      address: p.server,
      port: p.port,
      uuid: p.uuid,
      password: p.password || p.auth, 
      encryption: p.cipher, 
      network: p.network || 'tcp',
      tls: p.tls || false,
      host: p.servername || p['ws-opts']?.headers?.Host || p['ws-headers']?.Host,
      path: p['ws-opts']?.path || p['ws-path'],
      originalLink: ''
    };

    node.originalLink = constructLink(node);
    if (node.address && node.port) nodes.push(node);
  });

  return nodes;
};

const parseHysteriaSingle = (json: any): ProxyNode => {
    const node: ProxyNode = {
        id: `hy2-${Date.now()}-${Math.random()}`,
        name: 'Hysteria2 Node',
        protocol: ProtocolType.HYSTERIA2,
        address: json.server ? json.server.split(':')[0] : '',
        port: json.server ? (parseInt(json.server.split(':')[1]) || 443) : 0,
        password: json.auth || json.password,
        tls: json.tls?.enabled !== false,
        originalLink: ''
    };
    node.originalLink = constructLink(node);
    return node;
}

const parseStandardLinks = (text: string): ProxyNode[] => {
    let content = text;
    try {
        if (!text.includes('://')) {
            content = atob(text.replace(/\s/g, ''));
        }
    } catch (e) {}
    
    return extractLinksRegex(content);
}

const extractLinksRegex = (text: string): ProxyNode[] => {
    const nodes: ProxyNode[] = [];
    // 允许 URL 包含更多特殊字符，并支持 # 后的注释
    const regex = /(vmess|vless|trojan|ss|hysteria2|hysteria|hy2|tuic):\/\/[^\s"',;]+/g;
    const matches = text.match(regex);

    if (matches) {
        matches.forEach((link, idx) => {
            let cleanLink = link;
            // 如果链接被其他字符粘连，尝试截断
            if(cleanLink.includes('"')) cleanLink = cleanLink.split('"')[0];
            if(cleanLink.includes("'")) cleanLink = cleanLink.split("'")[0];
            if(cleanLink.includes(",")) cleanLink = cleanLink.split(",")[0];

            let protocol = ProtocolType.UNKNOWN;
            if (cleanLink.startsWith('vmess://')) protocol = ProtocolType.VMESS;
            else if (cleanLink.startsWith('vless://')) protocol = ProtocolType.VLESS;
            else if (cleanLink.startsWith('trojan://')) protocol = ProtocolType.TROJAN;
            else if (cleanLink.startsWith('ss://')) protocol = ProtocolType.SHADOWSOCKS;
            else if (cleanLink.startsWith('hysteria2://')) protocol = ProtocolType.HYSTERIA2;
            else if (cleanLink.startsWith('hysteria://')) protocol = ProtocolType.HYSTERIA;
            else if (cleanLink.startsWith('hy2://')) protocol = ProtocolType.HYSTERIA2;
            else if (cleanLink.startsWith('tuic://')) protocol = ProtocolType.TUIC;

            if (protocol !== ProtocolType.UNKNOWN) {
                 nodes.push({
                    id: `regex-${Date.now()}-${idx}`,
                    name: `Extracted Node ${idx + 1}`,
                    protocol,
                    address: 'unknown', 
                    port: 0,
                    originalLink: cleanLink
                });
            }
        });
    }
    return nodes;
}

// --- Helpers ---

const mapSingboxTypeToProtocol = (type: string): ProtocolType => {
  const t = type.toLowerCase();
  if (t === 'vmess') return ProtocolType.VMESS;
  if (t === 'vless') return ProtocolType.VLESS;
  if (t === 'trojan') return ProtocolType.TROJAN;
  if (t === 'shadowsocks') return ProtocolType.SHADOWSOCKS;
  if (t === 'hysteria2') return ProtocolType.HYSTERIA2;
  if (t === 'tuic') return ProtocolType.TUIC;
  return ProtocolType.UNKNOWN;
};

const mapClashTypeToProtocol = (type: string): ProtocolType => {
  const t = type.toLowerCase();
  if (t === 'vmess') return ProtocolType.VMESS;
  if (t === 'vless') return ProtocolType.VLESS;
  if (t === 'trojan') return ProtocolType.TROJAN;
  if (t === 'ss') return ProtocolType.SHADOWSOCKS;
  if (t === 'hysteria2') return ProtocolType.HYSTERIA2;
  return ProtocolType.UNKNOWN;
};

const constructLink = (n: ProxyNode): string => {
  try {
      if (n.originalLink) return n.originalLink;

      if (n.protocol === ProtocolType.VLESS) {
        const params = new URLSearchParams();
        params.set('encryption', 'none');
        if (n.network && n.network !== 'tcp') params.set('type', n.network);
        if (n.tls) params.set('security', 'tls');
        if (n.host) params.set('host', n.host);
        if (n.path) params.set('path', n.path);
        return `vless://${n.uuid}@${n.address}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`;
      }
      
      if (n.protocol === ProtocolType.VMESS) {
         const vmessJson = {
             v: "2", ps: n.name, add: n.address, port: n.port, id: n.uuid, aid: "0", scy: "auto",
             net: n.network || "tcp", type: "none", host: n.host || "", path: n.path || "", tls: n.tls ? "tls" : ""
         };
         return `vmess://${btoa(JSON.stringify(vmessJson))}`;
      }

      if (n.protocol === ProtocolType.HYSTERIA2) {
          const params = new URLSearchParams();
          if (n.host) params.set('sni', n.host);
          params.set('insecure', '1');
          return `hysteria2://${encodeURIComponent(n.password || '')}@${n.address}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`;
      }
      
      if (n.protocol === ProtocolType.TROJAN) {
          const params = new URLSearchParams();
          if (n.host) params.set('sni', n.host);
          return `trojan://${encodeURIComponent(n.password || '')}@${n.address}:${n.port}?${params.toString()}#${encodeURIComponent(n.name)}`;
      }

      if (n.protocol === ProtocolType.SHADOWSOCKS) {
          const userinfo = btoa(`${n.encryption}:${n.password}`);
          return `ss://${userinfo}@${n.address}:${n.port}#${encodeURIComponent(n.name)}`;
      }

      return '';
  } catch (e) {
      return '';
  }
};
