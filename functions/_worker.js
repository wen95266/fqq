/**
 * Cloudflare Pages Functions - Backend Worker (Ultimate Edition v5)
 * 
 * Update Log:
 * - Bot: Added QR Code image response (sendPhoto)
 * - Bot: Added detailed protocol statistics in Status/Update
 * - Bot: Added "Check Config" command
 * - Core: Refined parser for better compatibility
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
    const isSub = ['all', 'vless', 'vmess', 'trojan', 'hysteria', 'hysteria2', 'clash', 'sub', 'subscribe', 'singbox'].some(t => pathPart.includes(t));
    
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
             // 鉴权：如果有 ADMIN_ID，则只响应 ADMIN_ID
             if (env.ADMIN_ID && chatId !== String(env.ADMIN_ID)) {
                 // Unauthorized
                 return new Response('OK');
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
    
    // Auto-detect type from URL path
    ['vless', 'vmess', 'hysteria2', 'hysteria', 'trojan', 'ss', 'clash', 'singbox'].forEach(t => {
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
    
    // --- Helper: Send Text ---
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

    // --- Helper: Send Photo (for QR) ---
    const sendPhoto = async (photoUrl, caption) => {
        await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId, 
                photo: photoUrl,
                caption: caption,
                parse_mode: 'HTML', 
                reply_markup: BOT_KEYBOARD
            })
        });
    };

    if (text.includes('立即更新')) {
        if (!env.KV) return send(`❌ <b>错误:</b> KV 未绑定。请在 Cloudflare Pages 后台绑定 KV Namespace。`);
        
        await send("⏳ <b>正在更新...</b>\n正在从预设源抓取并解析节点 (支持 VLESS/VMess/Hysteria/Trojan/SS)...");
        const start = Date.now();
        
        try {
            const nodes = await fetchAndParseAll(PRESET_URLS);
            if (nodes.length === 0) return send(`⚠️ <b>警告:</b> 抓取完成，但有效节点数为 0。`);

            await env.KV.put('NODES', JSON.stringify(nodes));
            const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
            await env.KV.put('LAST_UPDATE', time);
            
            // Generate Protocol Stats
            const stats = {};
            nodes.forEach(n => { stats[n.p] = (stats[n.p] || 0) + 1; });
            const statsStr = Object.entries(stats).map(([k, v]) => `• ${k.toUpperCase()}: ${v}`).join('\n');

            await send(`✅ <b>更新成功</b>\n\n📊 <b>节点总数:</b> ${nodes.length}\n${statsStr}\n\n⏱️ 耗时: ${((Date.now()-start)/1000).toFixed(1)}s\n🕒 时间: ${time}`);
        } catch (e) {
            await send(`❌ <b>更新失败:</b> ${e.message}`);
        }

    } else if (text.includes('系统状态')) {
        let count = 0;
        let last = "无";
        let statsStr = "";
        
        if (env.KV) {
            const s = await env.KV.get('NODES');
            if(s) {
                const nodes = JSON.parse(s);
                count = nodes.length;
                const stats = {};
                nodes.forEach(n => { stats[n.p] = (stats[n.p] || 0) + 1; });
                statsStr = Object.entries(stats).map(([k, v]) => `• ${k.toUpperCase()}: ${v}`).join('\n');
            }
            last = await env.KV.get('LAST_UPDATE') || "无";
        }
        
        await send(`📊 <b>系统状态</b>\n\n🟢 <b>节点总数:</b> ${count}\n${statsStr}\n\n🕒 <b>上次更新:</b> ${last}`);

    } else if (text.includes('订阅链接')) {
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(origin + '/all')}`;
        const msg = [
            `🔗 <b>订阅链接 (Subscription)</b>`,
            ``,
            `🌍 <b>Universal (通用):</b>`,
            `<code>${origin}/all</code>`,
            ``,
            `🚀 <b>VLESS:</b>`,
            `<code>${origin}/vless</code>`,
            ``,
            `⚡ <b>Hysteria 2:</b>`,
            `<code>${origin}/hysteria2</code>`,
            ``,
            `🐱 <b>Clash:</b>`,
            `<code>${origin}/clash</code>`
        ].join('\n');

        // Attempt to send Photo with Caption
        try {
            await sendPhoto(qrApi, msg);
        } catch(e) {
            // Fallback to text if photo fails
            await send(msg);
        }

    } else if (text.includes('检测配置')) {
        const checks = [
            `⚙️ <b>配置检测</b>`,
            ``,
            `KV Binding: ${env.KV ? '✅' : '❌ (未绑定)'}`,
            `TG_TOKEN: ${env.TG_TOKEN ? '✅' : '❌ (未设置)'}`,
            `ADMIN_ID: ${env.ADMIN_ID ? '✅' : '⚠️ (公开模式)'}`,
            `Domain: ${origin}`,
            `Parse Engine: Ultimate v5`
        ].join('\n');
        await send(checks);

    } else {
        await send(`👋 <b>SubLink Bot Ready</b>\n\n请点击底部键盘菜单进行操作。`);
    }
}

// ==========================================
// 4. Ultimate Parser Logic (v5)
// ==========================================
async function fetchAndParseAll(urls) {
    const nodes = [];
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (u) => {
            try {
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
                    // Detect if it is Base64
                    if (!text.includes(' ') && !text.includes('\n') && text.length > 20) {
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
    // This handles the "outbounds" item that contains nested servers
    if (obj.protocol && obj.settings) {
        let foundChildren = false;
        if (obj.settings.vnext && Array.isArray(obj.settings.vnext)) {
            obj.settings.vnext.forEach(v => {
                const subNode = parseXrayChild(obj.protocol, v, obj.streamSettings);
                if (subNode) results.push(subNode);
            });
            foundChildren = true;
        }
        if (obj.settings.servers && Array.isArray(obj.settings.servers)) {
            obj.settings.servers.forEach(v => {
                const subNode = parseXrayChild(obj.protocol, v, obj.streamSettings);
                if (subNode) results.push(subNode);
            });
            foundChildren = true;
        }
        if (foundChildren) return results; 
    }

    // --- Case B: Direct Node Object ---
    const node = parseFlatNode(obj);
    if (node) {
        results.push(node);
        // Standard Sing-box objects don't nest further
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

// Helper: Case-insensitive property getter
function getProp(obj, keys) {
    if (!Array.isArray(keys)) keys = [keys];
    const objKeys = Object.keys(obj);
    for (const k of keys) {
        const found = objKeys.find(ok => ok.toLowerCase() === k.toLowerCase());
        if (found) return obj[found];
    }
    return undefined;
}

// Parse "Flat" nodes (Sing-box, Clash, Hysteria root objects)
function parseFlatNode(ob) {
    // 1. Determine Address/Port first (Critical)
    let server = getProp(ob, ['server', 'ip', 'address', 'server_address']);
    let port = getProp(ob, ['server_port', 'port']);

    // Handle "host:port" string in server field
    if (server && typeof server === 'string' && server.includes(':') && !server.includes('://')) {
        const parts = server.split(':');
        if (parts.length === 2 && !isNaN(parts[1])) {
            server = parts[0];
            port = parseInt(parts[1]);
        }
    }
    
    if (!server || !port) return null;

    // 2. Determine Type
    let type = getProp(ob, ['type', 'protocol', 'network']);
    type = (type || '').toLowerCase();
    
    // Aggressive Type Inference
    if (!type) {
        if (getProp(ob, ['uuid', 'id', 'user_id'])) type = 'vless'; 
        else if (getProp(ob, ['auth_str', 'auth_payload', 'up_mbps'])) type = 'hysteria';
        else if (getProp(ob, ['password']) && getProp(ob, ['method', 'cipher'])) type = 'ss';
        else if (getProp(ob, ['password']) && !getProp(ob, ['method'])) type = 'trojan'; 
    }

    // Disambiguate VLESS/VMess if inferred solely by UUID
    if (type === 'vless' && (getProp(ob, ['alterId', 'alter_id']) || 0) > 0) {
        type = 'vmess';
    }
    
    if (!type || ['selector', 'urltest', 'direct', 'block', 'dns', 'reject', 'field', 'http', 'socks'].includes(type)) return null;

    const tag = getProp(ob, ['tag', 'name', 'ps', 'remarks']) || `Node-${Math.floor(Math.random()*10000)}`;
    const uuid = getProp(ob, ['uuid', 'id', 'user_id']);
    const password = getProp(ob, ['password', 'auth', 'auth_str']);
    
    // TLS / Transport Commons
    const tlsObj = getProp(ob, ['tls']) || {};
    const isTls = tlsObj === true || tlsObj.enabled === true || getProp(ob, ['tls']) === true;
    const sni = getProp(tlsObj, ['server_name', 'sni']) || getProp(ob, ['sni', 'servername', 'host']);
    const insecure = getProp(tlsObj, ['insecure']) || getProp(ob, ['insecure', 'skip-cert-verify']) ? '1' : '0';
    
    const transport = getProp(ob, ['transport']) || {};
    const network = getProp(transport, ['type']) || getProp(ob, ['network', 'net']) || 'tcp';
    const host = getProp(transport, ['headers'])?.Host || getProp(ob, ['host', 'ws-headers'])?.Host || sni;
    const path = getProp(transport, ['path']) || getProp(ob, ['path', 'ws-path']);

    try {
        // --- Hysteria 2 ---
        if (type.includes('hysteria2') || (type === 'hysteria' && !getProp(ob, ['up_mbps']))) {
            const params = new URLSearchParams();
            if (sni) params.set('sni', sni);
            if (insecure === '1') params.set('insecure', '1');
            return { l: `hysteria2://${password}@${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'hysteria2', n: tag };
        }

        // --- Hysteria 1 ---
        if (type.includes('hysteria')) {
            const params = new URLSearchParams();
            params.set('peer', sni || server);
            if (insecure === '1') params.set('insecure', '1');
            const up = getProp(ob, ['up', 'up_mbps']);
            const down = getProp(ob, ['down', 'down_mbps']);
            if (up) params.set('up', up);
            if (down) params.set('down', down);
            if (password) params.set('auth', password);
            
            return { l: `hysteria://${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'hysteria', n: tag };
        }

        // --- VLESS ---
        if (type === 'vless') {
            const params = new URLSearchParams();
            params.set('encryption', 'none');
            
            if (network !== 'tcp') params.set('type', network === 'http' ? 'tcp' : network);
            if (network === 'http') params.set('headerType', 'http');
            
            if (isTls) params.set('security', 'tls');
            if (sni) params.set('sni', sni);
            if (insecure === '1') params.set('allowInsecure', '1');
            
            if (host) params.set('host', host);
            if (path) params.set('path', path);
            
            const serviceName = getProp(transport, ['service_name']) || getProp(ob, ['serviceName', 'grpc-service-name']);
            if (serviceName) params.set('serviceName', serviceName);
            
            const fp = getProp(ob, ['fingerprint', 'fp']);
            if (fp) params.set('fp', fp);

            // Reality
            const reality = getProp(tlsObj, ['reality']) || getProp(ob, ['reality']);
            if (reality && (reality.enabled || reality.public_key)) {
                params.set('security', 'reality');
                if (reality.public_key) params.set('pbk', reality.public_key);
                if (reality.short_id) params.set('sid', reality.short_id);
            }

            return { l: `vless://${uuid}@${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'vless', n: tag };
        }

        // --- VMess ---
        if (type === 'vmess') {
            const vmess = {
                v: "2", ps: tag, add: server, port: port, id: uuid, 
                aid: getProp(ob, ['alterId', 'alter_id']) || 0,
                scy: getProp(ob, ['cipher', 'security']) || "auto",
                net: network,
                type: "none",
                host: host || "",
                path: path || "",
                tls: isTls ? "tls" : ""
            };
            if (network === 'grpc') {
                vmess.path = getProp(transport, ['service_name']) || ""; 
            }
            
            return { l: `vmess://${safeBtoa(JSON.stringify(vmess))}`, p: 'vmess', n: tag };
        }

        // --- Shadowsocks ---
        if (type === 'shadowsocks' || type === 'ss') {
            const method = getProp(ob, ['method', 'cipher']);
            if (method && password) {
                const auth = `${method}:${password}`;
                return { l: `ss://${safeBtoa(auth)}@${server}:${port}#${encodeURIComponent(tag)}`, p: 'ss', n: tag };
            }
        }
        
        // --- Trojan ---
        if (type === 'trojan') {
            const params = new URLSearchParams();
            if (sni) params.set('sni', sni);
            if (insecure === '1') params.set('allowInsecure', '1');
            return { l: `trojan://${password}@${server}:${port}?${params}#${encodeURIComponent(tag)}`, p: 'trojan', n: tag };
        }

    } catch(e) {}
    
    return null;
}

// Handle Xray's split structure
function parseXrayChild(protocol, vChild, streamSettings) {
    if (!vChild.address || !vChild.port) return null;
    
    // Combine into a single object for parseFlatNode
    const node = {
        protocol: protocol,
        server: vChild.address,
        port: vChild.port,
        tag: `Xray-${protocol}-${Math.floor(Math.random()*1000)}`,
        ...streamSettings
    };

    if (vChild.users && vChild.users[0]) {
        const u = vChild.users[0];
        node.uuid = u.id;
        node.password = u.password;
        node.security = u.security;
        node.alter_id = u.alterId;
        node.method = u.method;
    }
    
    // Handle Xray-specific streamSettings nesting
    if (streamSettings) {
        node.network = streamSettings.network;
        if (streamSettings.security === 'tls') {
             node.tls = { enabled: true, server_name: streamSettings.tlsSettings?.serverName };
             // Merge allowInsecure if present
             if (streamSettings.tlsSettings?.allowInsecure) node.insecure = true;
        }
        if (streamSettings.wsSettings) {
             node['path'] = streamSettings.wsSettings.path;
             node['host'] = streamSettings.wsSettings.headers?.Host;
        }
        if (streamSettings.grpcSettings) {
             node['serviceName'] = streamSettings.grpcSettings.serviceName;
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
    // 1. Strip whitespace
    str = str.replace(/\s/g, '');
    // 2. URL Safe fix
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    // 3. Padding fix
    while (str.length % 4) str += '=';
    
    try {
        return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    } catch (e) { 
        try { return atob(str); } catch(e2) { return str; }
    }
}
