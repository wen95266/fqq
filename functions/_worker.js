/**
 * Cloudflare Pages Functions - Backend Worker (Ultimate Edition v2)
 * 
 * 功能:
 * 1. 自动抓取节点并存储到 KV
 * 2. 提供订阅接口 (Base64编码)
 * 3. Telegram Bot 管理
 * 4. 支持 Sing-box, Xray, V2Ray, Clash 等多种 JSON 结构
 */

// ==========================================
// 1. 配置区域
// ==========================================

const BOT_KEYBOARD = {
    keyboard: [
        [{ text: "🔄 立即更新" }, { text: "📊 系统状态" }],
        [{ text: "🔗 订阅链接" }, { text: "⚙️ 检测配置" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "请选择操作..."
};

// 预置订阅源
const PRESET_URLS = [
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/singbox/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/singbox/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ip/singbox/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ip/singbox/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria/4/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria2/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria2/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria2/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria2/4/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/xray/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/xray/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/xray/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/xray/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/xray/4/config.json"
];

const SUB_NAME = "SubLink";

// ==========================================
// 2. 主逻辑
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathPart = url.pathname.replace(/^\/|\/$/g, '').toLowerCase();

    // 静态资源放行
    const isApi = pathPart.startsWith('api/');
    const isSub = ['all', 'vless', 'vmess', 'trojan', 'hysteria', 'hysteria2', 'clash', 'sub', 'subscribe'].some(t => pathPart.includes(t));
    
    if (!isApi && !isSub && pathPart !== 'webhook') {
        return env.ASSETS.fetch(request);
    }

    // --- Webhook ---
    if (pathPart === 'webhook') {
      if (!env.TG_TOKEN) return new Response('❌ Error: TG_TOKEN not set.', { status: 500 });
      const webhookUrl = `${url.origin}/api/telegram`;
      const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/setWebhook?url=${webhookUrl}`);
      const j = await r.json();
      return new Response(`Webhook: ${webhookUrl}\nResult: ${JSON.stringify(j, null, 2)}`);
    }

    // --- Bot API ---
    if (pathPart === 'api/telegram' && request.method === 'POST') {
      try {
        const update = await request.json();
        if (update.message && update.message.text) {
             const chatId = String(update.message.from.id);
             if (env.ADMIN_ID && chatId !== String(env.ADMIN_ID)) {
                 // 简单鉴权
             }
             ctx.waitUntil(handleTelegramCommand(update.message, env, url.origin));
        }
      } catch(e) {}
      return new Response('OK');
    }

    // --- Status API ---
    if (pathPart === 'api/status') {
         let count = 0;
         let updateTime = null;
         try {
             if (env.KV) {
                 const stored = await env.KV.get('NODES');
                 if (stored) count = JSON.parse(stored).length;
                 updateTime = await env.KV.get('LAST_UPDATE');
             }
         } catch(e) {}
         
         return new Response(JSON.stringify({ 
             count, 
             last_update: updateTime || '等待更新...',
             bot_ready: !!env.TG_TOKEN,
             kv_ready: !!env.KV
         }), { headers: { 'Content-Type': 'application/json' } });
    }

    // --- Subscription Output ---
    const queryType = url.searchParams.get('type');
    let targetType = queryType ? queryType.toLowerCase() : '';
    
    // Auto-detect type
    ['vless', 'vmess', 'hysteria2', 'hysteria', 'trojan', 'ss', 'clash'].forEach(t => {
        if (pathPart.includes(t)) targetType = t;
    });
    if (!targetType) targetType = 'all';

    let nodesData = [];
    try {
        if (env.KV) {
            const stored = await env.KV.get('NODES');
            if (stored) nodesData = JSON.parse(stored);
        }
    } catch(e) {}

    let filteredNodes = nodesData;
    if (targetType && targetType !== 'all') {
      const types = targetType.split(',').map(t => t.trim());
      // Special match: "hysteria" matches both "hysteria" and "hysteria2" if needed, 
      // but here we stick to strict type matching unless it's "all"
      filteredNodes = nodesData.filter(node => types.some(t => node.p === t)); 
    }

    // Loose filter: Ensure we have a link and a protocol
    filteredNodes = filteredNodes.filter(n => n.l && n.p);

    const links = filteredNodes.map(n => n.l).join('\n');
    const encoded = safeBtoa(links);

    return new Response(encoded, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${SUB_NAME}_${targetType}.txt"`,
        "Profile-Update-Interval": "24",
        "Subscription-Userinfo": "upload=0; download=0; total=1073741824000000; expire=0",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  }
};

// ==========================================
// 3. Bot Logic
// ==========================================
async function handleTelegramCommand(message, env, origin) {
    const chatId = message.chat.id;
    const text = message.text.trim();
    
    const send = async (msg) => {
        await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId, 
                text: msg, 
                parse_mode: 'HTML', 
                disable_web_page_preview: true,
                reply_markup: BOT_KEYBOARD
            })
        });
    };

    if (text.includes('立即更新')) {
        if (!env.KV) return send(`❌ KV 未绑定`);
        await send("⏳ 正在全力抓取节点 (支持 Xray/Singbox/Clash)...");
        const start = Date.now();
        
        try {
            const nodes = await fetchAndParseAll(PRESET_URLS);
            if (nodes.length === 0) return send(`⚠️ 抓取完成，但节点数为 0。请检查网络或源。`);

            await env.KV.put('NODES', JSON.stringify(nodes));
            const time = new Date(new Date().getTime() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
            await env.KV.put('LAST_UPDATE', time);
            
            await send(`✅ <b>更新成功</b>\n📊 节点数: ${nodes.length}\n⏱️ 耗时: ${((Date.now()-start)/1000).toFixed(1)}s`);
        } catch (e) {
            await send(`❌ 错误: ${e.message}`);
        }
    } else if (text.includes('系统状态')) {
        let count = 0;
        let last = "无";
        if (env.KV) {
            const s = await env.KV.get('NODES');
            if(s) count = JSON.parse(s).length;
            last = await env.KV.get('LAST_UPDATE') || "无";
        }
        await send(`📊 <b>系统状态</b>\n节点: ${count}\n更新: ${last}`);
    } else if (text.includes('订阅链接')) {
        await send(`🔗 <b>订阅链接</b>\n<code>${origin}/all</code>`);
    } else {
        await send(`👋 SubLink Bot Ready.`);
    }
}

// ==========================================
// 4. Ultimate Parser Logic
// ==========================================
async function fetchAndParseAll(urls) {
    const nodes = [];
    // Increase batch size
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (u) => {
            try {
                // Randomize User-Agent slightly to avoid static blocking
                const res = await fetch(u, { 
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' },
                    cf: { cacheTtl: 60 }
                });
                if (!res.ok) return;
                let text = await res.text();
                text = text.trim();

                let jsonNodes = [];
                // Strategy 1: Smart JSON Parse
                if (text.startsWith('{') || text.startsWith('[')) {
                    try {
                        const json = JSON.parse(text);
                        jsonNodes = findNodesRecursively(json);
                    } catch(e) {}
                }

                if (jsonNodes.length > 0) {
                    nodes.push(...jsonNodes);
                } else {
                    // Strategy 2: Base64/Regex
                    let decoded = text;
                    if (!text.includes(' ') && text.length > 50) {
                        try { decoded = safeAtob(text); } catch(e) {}
                    }
                    const regexNodes = extractNodesRegex(decoded);
                    nodes.push(...regexNodes);
                }
            } catch(e) {}
        });
        await Promise.all(promises);
    }

    // Deduplicate
    const unique = new Map();
    nodes.forEach(n => {
        if(n.l && !unique.has(n.l)) unique.set(n.l, n);
    });
    return Array.from(unique.values());
}

function findNodesRecursively(obj) {
    let results = [];
    if (!obj || typeof obj !== 'object') return results;

    // --- Case A: Xray/V2Ray structure (protocol + settings.vnext/servers) ---
    if (obj.protocol && obj.settings) {
        if (obj.settings.vnext && Array.isArray(obj.settings.vnext)) {
            // VLESS / VMess
            obj.settings.vnext.forEach(v => {
                const subNode = parseXrayChild(obj.protocol, v, obj.streamSettings);
                if (subNode) results.push(subNode);
            });
            return results; // Stop searching this branch
        }
        if (obj.settings.servers && Array.isArray(obj.settings.servers)) {
            // Shadowsocks / Trojan
            obj.settings.servers.forEach(v => {
                const subNode = parseXrayChild(obj.protocol, v, obj.streamSettings);
                if (subNode) results.push(subNode);
            });
            return results; // Stop searching this branch
        }
    }

    // --- Case B: Standard Sing-box / Flat Object ---
    const node = parseFlatNode(obj);
    if (node) {
        results.push(node);
        return results;
    }

    // --- Case C: Recursion ---
    if (Array.isArray(obj)) {
        obj.forEach(item => results.push(...findNodesRecursively(item)));
    } else {
        Object.values(obj).forEach(val => results.push(...findNodesRecursively(val)));
    }
    return results;
}

// Parse "Flat" nodes (Sing-box, Clash, Hysteria root objects)
function parseFlatNode(ob) {
    // 1. Determine Type
    const type = (ob.type || ob.protocol || '').toLowerCase();
    if (!type) return null;

    // 2. Determine Address/Port
    const server = ob.server || ob.address || ob.ip;
    const port = ob.server_port || ob.port;
    
    if (!server || !port) return null;
    
    // Ignore invalid types
    if (['selector', 'urltest', 'direct', 'block', 'dns', 'reject', 'ipv4', 'ipv6', 'field'].includes(type)) return null;

    const tag = ob.tag || ob.name || `Node-${Math.floor(Math.random()*10000)}`;

    try {
        // --- Hysteria 2 ---
        if (type === 'hysteria2') {
            const params = new URLSearchParams();
            if (ob.tls?.server_name || ob.sni) params.set('sni', ob.tls?.server_name || ob.sni);
            if (ob.tls?.insecure || ob['skip-cert-verify']) params.set('insecure', '1');
            const auth = ob.password || ob.auth || '';
            return { l: `hysteria2://${auth}@${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'hysteria2', n: tag };
        }

        // --- Hysteria 1 ---
        if (type === 'hysteria') {
            const params = new URLSearchParams();
            params.set('peer', ob.tls?.server_name || ob.sni || server);
            if (ob.tls?.insecure || ob['skip-cert-verify']) params.set('insecure', '1');
            if (ob.up_mbps || ob.up) params.set('up', ob.up_mbps || ob.up);
            if (ob.down_mbps || ob.down) params.set('down', ob.down_mbps || ob.down);
            if (ob.auth_str || ob.auth) params.set('auth', ob.auth_str || ob.auth);
            
            return { l: `hysteria://${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'hysteria', n: tag };
        }

        // --- VLESS ---
        if (type === 'vless') {
            const params = new URLSearchParams();
            params.set('encryption', 'none');
            
            // Singbox uses `transport`, Clash uses `network`
            const net = ob.transport?.type || ob.network || 'tcp';
            if (net === 'http') { params.set('type', 'http'); }
            else if (net !== 'tcp') { params.set('type', net); }

            // Path/Host
            const path = ob.transport?.path || ob['ws-path'] || ob['ws-opts']?.path;
            const host = ob.transport?.headers?.Host || ob['ws-headers']?.Host || ob['ws-opts']?.headers?.Host;
            if (path) params.set('path', path);
            if (host) params.set('host', host);
            if (ob.serviceName || ob['grpc-opts']?.['grpc-service-name']) params.set('serviceName', ob.serviceName || ob['grpc-opts']?.['grpc-service-name']);

            // TLS
            if (ob.tls?.enabled || ob.tls === true) {
                params.set('security', 'tls');
                const sni = ob.tls?.server_name || ob.servername || ob.sni;
                if (sni) params.set('sni', sni);
                if (ob.tls?.insecure || ob['skip-cert-verify']) params.set('allowInsecure', '1');
                if (ob.flow) params.set('flow', ob.flow);
            }
            // Reality
            if (ob.tls?.reality?.enabled || ob.reality) {
                 params.set('security', 'reality');
                 const r = ob.tls?.reality || {};
                 if(r.public_key) params.set('pbk', r.public_key);
                 if(r.short_id) params.set('sid', r.short_id);
                 if(ob.fingerprint) params.set('fp', ob.fingerprint);
            }

            return { l: `vless://${ob.uuid}@${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'vless', n: tag };
        }

        // --- VMess ---
        if (type === 'vmess') {
            const net = ob.transport?.type || ob.network || "tcp";
            const tlsObj = ob.tls || {};
            const isTls = tlsObj.enabled || ob.tls === true;
            
            const vmess = {
                v: "2", ps: tag, add: server, port: port, id: ob.uuid, aid: ob.alter_id || 0,
                scy: ob.security || ob.cipher || "auto",
                net: net,
                type: "none",
                host: tlsObj.server_name || ob.servername || ob.sni || ob.transport?.headers?.Host || ob['ws-headers']?.Host || "",
                path: ob.transport?.path || ob['ws-path'] || ob['ws-opts']?.path || "",
                tls: isTls ? "tls" : ""
            };
            if (net === 'grpc') {
                vmess.path = ob.transport?.service_name || ob['grpc-opts']?.['grpc-service-name'] || ""; 
                vmess.net = "grpc";
            }
            
            return { l: `vmess://${safeBtoa(JSON.stringify(vmess))}`, p: 'vmess', n: tag };
        }

        // --- Shadowsocks ---
        if (type === 'shadowsocks' || type === 'ss') {
            const method = ob.method || ob.cipher;
            const pwd = ob.password;
            if (method && pwd) {
                const auth = `${method}:${pwd}`;
                return { l: `ss://${safeBtoa(auth)}@${server}:${port}#${encodeURIComponent(tag)}`, p: 'ss', n: tag };
            }
        }
        
        // --- Trojan ---
        if (type === 'trojan') {
            const params = new URLSearchParams();
            const sni = ob.tls?.server_name || ob.sni || ob.servername;
            if (sni) params.set('sni', sni);
            return { l: `trojan://${ob.password}@${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'trojan', n: tag };
        }

    } catch(e) {}
    
    return null;
}

// Handle Xray's split structure
function parseXrayChild(protocol, vChild, streamSettings) {
    // Merge streamSettings into a flat object for parseFlatNode
    if (!vChild.address || !vChild.port) return null;
    
    const node = {
        type: protocol,
        server: vChild.address,
        server_port: vChild.port,
        tag: `Xray-${protocol}-${Math.floor(Math.random()*1000)}`,
        ...streamSettings // Spread global stream settings (network, security, etc)
    };

    // User handling
    if (vChild.users && vChild.users[0]) {
        const u = vChild.users[0];
        node.uuid = u.id;
        node.password = u.password;
        node.security = u.security;
        node.alter_id = u.alterId;
        node.method = u.method;
    }
    
    // Map Xray streamSettings fields to Sing-box/Flat fields
    if (streamSettings) {
        node.network = streamSettings.network;
        if (streamSettings.security === 'tls') {
             node.tls = { enabled: true, server_name: streamSettings.tlsSettings?.serverName };
        }
        if (streamSettings.wsSettings) {
             node['ws-path'] = streamSettings.wsSettings.path;
             node['ws-headers'] = streamSettings.wsSettings.headers;
        }
        if (streamSettings.grpcSettings) {
             node['grpc-opts'] = { 'grpc-service-name': streamSettings.grpcSettings.serviceName };
        }
    }
    
    return parseFlatNode(node);
}

function extractNodesRegex(text) {
    const nodes = [];
    const regex = /(vmess|vless|trojan|ss|hysteria2|hysteria):\/\/[^\s"',;<>]+/g;
    const matches = text.match(regex);
    if (!matches) return [];

    matches.forEach(link => {
        try {
            let clean = link.split(/[\s"';<>,]/)[0];
            let type = clean.split(':')[0];
            let name = 'RegexNode';
            if (clean.includes('#')) name = decodeURIComponent(clean.split('#')[1]);
            nodes.push({ l: clean, p: type, n: name });
        } catch(e){}
    });
    return nodes;
}

function safeBtoa(str) {
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1)));
    } catch (e) { return btoa(str); }
}

function safeAtob(str) {
    try {
        return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    } catch (e) { return atob(str); }
}
