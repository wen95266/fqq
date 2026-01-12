/**
 * Cloudflare Pages Functions - Backend Worker (Ultimate Edition v10)
 * 
 * Update Log v10:
 * - 修复: Hysteria2 密码处理 - 正确处理空密码和 URI 编码
 * - 修复: Hysteria 节点识别 - 增强类型检测逻辑
 * - 修复: Hysteria2 users 数组深度解析
 * - 新增: 更宽松的 JSON 解析，支持各种配置格式
 * - 优化: 节点去重策略，确保 Hysteria/Hysteria2 区分
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

// 预置订阅源 - 确保包含 Hysteria/Hysteria2 源
const PRESET_URLS = [
  // Sing-box 配置源
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/singbox/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/singbox/1/config.json",
  
  // Hysteria 配置源
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria/4/config.json",
  
  // Hysteria2 配置源
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/1/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria2/1/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/2/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria2/2/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/3/config.json",
  "https://gitlab.com/free9999/ipupdate/-/raw/master/backup/img/1/2/ipp/hysteria2/3/config.json",
  "https://www.gitlabip.xyz/Alvin9999/PAC/master/backup/img/1/2/ipp/hysteria2/4/config.json",
  "https://fastly.jsdelivr.net/gh/Alvin9999/PAC@latest/backup/img/1/2/ipp/hysteria2/4/config.json",
  
  // Xray 配置源
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
             if (env.ADMIN_ID && chatId !== String(env.ADMIN_ID)) {
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
      filteredNodes = nodesData.filter(node => types.some(t => node.p === t)); 
    }
    
    // Final sanity check
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
        if (!env.KV) return send(`❌ <b>错误:</b> KV 未绑定。`);
        
        await send("⏳ <b>正在更新...</b>\n正在从预设源抓取 (Deep Scan Mode)...");
        const start = Date.now();
        
        try {
            const nodes = await fetchAndParseAll(PRESET_URLS);
            
            const stats = {};
            nodes.forEach(n => { stats[n.p] = (stats[n.p] || 0) + 1; });
            const statsStr = Object.entries(stats)
                .map(([k, v]) => `• <b>${k.toUpperCase()}</b>: ${v}`)
                .join('\n');

            if (nodes.length === 0) return send(`⚠️ <b>警告:</b> 有效节点数为 0。\n请检查订阅源是否有效。`);

            await env.KV.put('NODES', JSON.stringify(nodes));
            const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
            await env.KV.put('LAST_UPDATE', time);
            
            await send(`✅ <b>更新成功</b>\n\n📊 <b>节点总数:</b> ${nodes.length}\n${statsStr}\n\n⏱️ 耗时: ${((Date.now()-start)/1000).toFixed(1)}s\n🕒 时间: ${time}`);
        } catch (e) {
            await send(`❌ <b>更新失败:</b> ${e.message}`);
        }

    } else if (text.includes('系统状态')) {
        let count = 0;
        let last = "无";
        let statsStr = "暂无数据";
        
        if (env.KV) {
            const s = await env.KV.get('NODES');
            if(s) {
                const nodes = JSON.parse(s);
                count = nodes.length;
                const stats = {};
                nodes.forEach(n => { stats[n.p] = (stats[n.p] || 0) + 1; });
                statsStr = Object.entries(stats)
                    .map(([k, v]) => `• <b>${k.toUpperCase()}</b>: ${v}`)
                    .join('\n');
            }
            last = await env.KV.get('LAST_UPDATE') || "无";
        }
        await send(`📊 <b>系统状态</b>\n\n🟢 <b>节点总数:</b> ${count}\n\n${statsStr}\n\n🕒 <b>上次更新:</b> ${last}`);

    } else if (text.includes('订阅链接')) {
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(origin + '/all')}`;
        const msg = [
            `🔗 <b>订阅链接 (Subscription)</b>`,
            `<code>${origin}/all</code>`,
            `<code>${origin}/vless</code>`,
            `<code>${origin}/vmess</code>`,
            `<code>${origin}/hysteria</code>`,
            `<code>${origin}/hysteria2</code>`
        ].join('\n');
        try { await sendPhoto(qrApi, msg); } catch(e) { await send(msg); }

    } else if (text.includes('检测配置')) {
        await send(`⚙️ <b>配置检测</b>\nKV: ${env.KV?'✅':'❌'}\nToken: ${env.TG_TOKEN?'✅':'❌'}\nEngine: v10 (HysteriaFix)`);
    } else {
        await send(`👋 <b>SubLink Bot Ready</b>`);
    }
}

// ==========================================
// 4. Ultimate Parser Logic (v10 - Hysteria Fix)
// ==========================================
async function fetchAndParseAll(urls) {
    const nodes = [];
    const BATCH_SIZE = 8;
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (u) => {
            try {
                const res = await fetch(u, { 
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    cf: { cacheTtl: 60 }
                });
                if (!res.ok) return;
                let text = await res.text();
                // Strip BOM
                text = text.replace(/^\uFEFF/, '').trim();

                let foundInThisUrl = [];

                // Strategy 1: Relaxed JSON Parse (handles comments, unquoted keys)
                const json = tryParseDirtyJSON(text);
                if (json) {
                    foundInThisUrl = findNodesRecursively(json);
                }

                // Strategy 2: Base64 -> Relaxed JSON
                if (foundInThisUrl.length === 0) {
                     if (!text.includes(' ') && !text.includes('\n')) {
                         try {
                             const decoded = safeAtob(text);
                             const jsonDecoded = tryParseDirtyJSON(decoded);
                             if (jsonDecoded) {
                                 foundInThisUrl = findNodesRecursively(jsonDecoded);
                             } else {
                                 foundInThisUrl = extractNodesRegex(decoded);
                             }
                         } catch(e) {}
                     } else {
                         foundInThisUrl = extractNodesRegex(text);
                     }
                }

                // 调试：记录当前URL找到的节点类型
                if (foundInThisUrl.length > 0) {
                    const types = foundInThisUrl.map(n => n.p).join(',');
                    console.log(`URL ${u} found: ${foundInThisUrl.length} nodes (${types})`);
                }
                
                nodes.push(...foundInThisUrl);
            } catch(e) {
                console.error(`Error parsing ${u}:`, e.message);
            }
        });
        await Promise.all(promises);
    }

    // Deduplicate (Use Link + Protocol to ensure Hysteria vs Hysteria2 distinction)
    const unique = new Map();
    nodes.forEach(n => {
        if(n.l) {
            const key = n.l + '|' + n.p;
            if(!unique.has(key)) unique.set(key, n);
        }
    });
    
    const result = Array.from(unique.values());
    console.log(`Total unique nodes: ${result.length}`);
    console.log(`Node types:`, result.reduce((acc, n) => {
        acc[n.p] = (acc[n.p] || 0) + 1;
        return acc;
    }, {}));
    
    return result;
}

// Powerful parser using new Function to handle JS objects/comments
function tryParseDirtyJSON(str) {
    if (!str || typeof str !== 'string') return null;
    try {
        // Try strict JSON first for speed
        return JSON.parse(str);
    } catch (e) {
        try {
            // Fallback to JS evaluation (sandbox-ish)
            // This handles comments //, unquoted keys { a: 1 }, trailing commas
            const cleaned = str
                .replace(/\/\/.*$/gm, '')  // Remove line comments
                .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
            return new Function('return (' + cleaned + ')')();
        } catch (e2) {
            return null;
        }
    }
}

function findNodesRecursively(obj) {
    let results = [];
    if (!obj || typeof obj !== 'object') return results;

    // --- Container Arrays ---
    if (Array.isArray(obj.outbounds)) obj.outbounds.forEach(o => results.push(...findNodesRecursively(o)));
    if (Array.isArray(obj.proxies)) obj.proxies.forEach(p => results.push(...findNodesRecursively(p)));
    
    // --- Xray Nested ---
    if (obj.settings && (obj.settings.vnext || obj.settings.servers)) {
        const target = obj.settings.vnext || obj.settings.servers;
        if (Array.isArray(target)) {
            target.forEach(v => {
                const subNode = parseXrayChild(obj.protocol, v, obj.streamSettings);
                if (subNode) results.push(subNode);
            });
        }
    }

    // --- Direct Node Check ---
    const node = parseFlatNode(obj);
    if (node) results.push(node);

    // --- General Recursion ---
    if (Array.isArray(obj)) {
        obj.forEach(item => results.push(...findNodesRecursively(item)));
    } else {
        Object.keys(obj).forEach(key => {
            // Avoid large data fields
            if (key !== 'body' && key !== 'data' && key !== 'payload') {
                results.push(...findNodesRecursively(obj[key]));
            }
        });
    }
    return results;
}

function getProp(obj, keys) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (!Array.isArray(keys)) keys = [keys];
    const objKeys = Object.keys(obj);
    for (const k of keys) {
        if (obj[k] !== undefined) return obj[k];
        const found = objKeys.find(ok => ok.toLowerCase() === k.toLowerCase());
        if (found) return obj[found];
    }
    return undefined;
}

function parseFlatNode(ob) {
    if (!ob || typeof ob !== 'object') return null;
    
    let server = getProp(ob, ['server', 'ip', 'address', 'server_address']);
    let port = getProp(ob, ['server_port', 'port', 'listen_port']);
    
    // Handle host:port string (e.g., "1.2.3.4:443")
    if (server && typeof server === 'string' && server.includes(':') && !server.includes('://')) {
        const parts = server.split(':');
        // Handle IPv6 [::]:port
        if (server.startsWith('[')) {
            const ipv6End = server.indexOf(']');
            if (ipv6End > 0) {
                server = server.substring(0, ipv6End + 1);
                port = parseInt(server.substring(ipv6End + 2));
            }
        } else if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
            server = parts[0];
            port = parseInt(parts[1]);
        }
    }
    
    // 如果没有端口，尝试从 listen 字段提取
    if (!port && ob.listen && typeof ob.listen === 'string') {
        const parts = ob.listen.split(':');
        if (parts.length === 2) port = parseInt(parts[1]);
    }
    
    if (!server || !port) return null;

    let type = getProp(ob, ['type', 'protocol', 'network']);
    type = (type || '').toLowerCase();
    
    // 增强的 Hysteria 类型检测
    if (!type) {
        // Hysteria2 特征检测
        if (getProp(ob, ['obfs']) && getProp(ob, ['obfs']).type === 'salamander') {
            type = 'hysteria2';
        }
        // Hysteria 特征检测
        else if (getProp(ob, ['up_mbps', 'down_mbps', 'auth_str', 'protocol'])) {
            type = 'hysteria';
        }
        // Hysteria2 用户数组检测
        else if (getProp(ob, ['users']) && Array.isArray(ob.users) && ob.users[0] && ob.users[0].password) {
            type = 'hysteria2';
        }
        // VLESS/VMess 检测
        else if (getProp(ob, ['uuid', 'id'])) {
            type = 'vless';
        }
        // Shadowsocks 检测
        else if (getProp(ob, ['password']) && getProp(ob, ['method', 'cipher'])) {
            type = 'ss';
        }
    }
    
    // VMess 检测 (有 alterId)
    if (type === 'vless' && (getProp(ob, ['alterId', 'alter_id']) || 0) > 0) {
        type = 'vmess';
    }
    
    // 过滤无效类型
    if (!type || ['selector', 'urltest', 'direct', 'block', 'dns', 'reject', 'field', 'http', 'socks'].includes(type)) {
        return null;
    }

    const tag = getProp(ob, ['tag', 'name', 'ps', 'remarks', 'id']) || `${type}-${server}:${port}`;
    const uuid = getProp(ob, ['uuid', 'id', 'user_id']);
    const tlsObj = getProp(ob, ['tls']) || {};
    const isTls = tlsObj === true || tlsObj.enabled === true || getProp(ob, ['tls']) === true;
    const sni = getProp(tlsObj, ['server_name', 'sni']) || getProp(ob, ['sni', 'servername', 'host']);
    const insecure = (getProp(tlsObj, ['insecure', 'ignore_insecure']) || getProp(ob, ['insecure', 'skip-cert-verify'])) ? '1' : '0';
    
    try {
        // --- Hysteria 2 ---
        if (type === 'hysteria2') {
            let password = getProp(ob, ['password', 'auth', 'auth_str']);
            // 深度处理 users 数组
            const users = getProp(ob, ['users']);
            if (!password && Array.isArray(users)) {
                for (const user of users) {
                    if (user.password || user.auth) {
                        password = user.password || user.auth;
                        break;
                    }
                }
            }
            
            // 如果没有密码，使用空字符串
            if (password === undefined) password = '';

            const params = new URLSearchParams();
            if (sni) params.set('sni', sni);
            if (insecure === '1') params.set('insecure', '1');
            
            // Obfs
            const obfs = getProp(ob, ['obfs']);
            if (obfs && typeof obfs === 'object') {
                 if (obfs.type === 'salamander') params.set('obfs', 'salamander');
                 if (obfs.password) params.set('obfs-password', obfs.password);
            }

            // 带宽设置
            const up = getProp(ob, ['up', 'up_mbps']);
            const down = getProp(ob, ['down', 'down_mbps']);
            if (up) params.set('up', up.toString());
            if (down) params.set('down', down.toString());

            const link = `hysteria2://${encodeURIComponent(password)}@${server}:${port}?${params}#${encodeURIComponent(tag)}`;
            return { 
                l: link, 
                p: 'hysteria2', 
                n: tag 
            };
        }

        // --- Hysteria 1 ---
        if (type === 'hysteria') {
            const params = new URLSearchParams();
            params.set('peer', sni || server);
            if (insecure === '1') params.set('insecure', '1');
            
            const up = getProp(ob, ['up', 'up_mbps']) || '100'; 
            const down = getProp(ob, ['down', 'down_mbps']) || '100';
            params.set('up', up.toString());
            params.set('down', down.toString());
            
            const auth = getProp(ob, ['auth', 'auth_str', 'password']);
            if (auth) params.set('auth', encodeURIComponent(auth));
            
            const protocol = getProp(ob, ['protocol']);
            if (protocol) params.set('protocol', protocol);

            // Obfs (Hysteria 1 的混淆)
            const obfs = getProp(ob, ['obfs']);
            if (obfs && typeof obfs === 'string') {
                params.set('obfs', obfs);
            }

            const link = `hysteria://${server}:${port}?${params}#${encodeURIComponent(tag)}`;
            return { 
                l: link, 
                p: 'hysteria', 
                n: tag 
            };
        }

        // --- VLESS ---
        if (type === 'vless') {
            const params = new URLSearchParams();
            params.set('encryption', 'none');
            
            const transport = getProp(ob, ['transport']) || {};
            const network = getProp(transport, ['type']) || getProp(ob, ['network', 'net']) || 'tcp';
            
            if (network !== 'tcp') params.set('type', network === 'http' ? 'tcp' : network);
            if (network === 'http') params.set('headerType', 'http');
            if (isTls) params.set('security', 'tls');
            if (sni) params.set('sni', sni);
            if (insecure === '1') params.set('allowInsecure', '1');
            
            const host = getProp(transport, ['headers'])?.Host || getProp(ob, ['host', 'ws-headers'])?.Host || sni;
            const path = getProp(transport, ['path']) || getProp(ob, ['path', 'ws-path']);
            if (host) params.set('host', host);
            if (path) params.set('path', path);
            
            const serviceName = getProp(transport, ['service_name']) || getProp(ob, ['serviceName', 'grpc-service-name']);
            if (serviceName) params.set('serviceName', serviceName);
            
            const flow = getProp(ob, ['flow']);
            if (flow) params.set('flow', flow);

            // Reality
            const reality = getProp(tlsObj, ['reality']) || getProp(ob, ['reality']);
            if (reality && (reality.enabled || reality.public_key)) {
                params.set('security', 'reality');
                if (reality.public_key) params.set('pbk', reality.public_key);
                if (reality.short_id) params.set('sid', reality.short_id);
            }

            const link = `vless://${uuid}@${server}:${port}?${params}#${encodeURIComponent(tag)}`;
            return { l: link, p: 'vless', n: tag };
        }

        // --- VMess ---
        if (type === 'vmess') {
            const transport = getProp(ob, ['transport']) || {};
            const network = getProp(transport, ['type']) || getProp(ob, ['network', 'net']) || 'tcp';
            const host = getProp(transport, ['headers'])?.Host || getProp(ob, ['host', 'ws-headers'])?.Host || sni;
            const path = getProp(transport, ['path']) || getProp(ob, ['path', 'ws-path']);
            
            const vmess = {
                v: "2", 
                ps: tag, 
                add: server, 
                port: port, 
                id: uuid, 
                aid: getProp(ob, ['alterId', 'alter_id']) || 0,
                scy: getProp(ob, ['cipher', 'security']) || "auto",
                net: network,
                type: "none",
                host: host || "",
                path: path || "",
                tls: isTls ? "tls" : "",
                sni: sni || ""
            };
            
            if (network === 'grpc') {
                vmess.path = getProp(transport, ['service_name']) || ""; 
                vmess.type = "gun";
            }
            
            const encoded = safeBtoa(JSON.stringify(vmess));
            return { l: `vmess://${encoded}`, p: 'vmess', n: tag };
        }
        
        // --- Trojan ---
        if (type === 'trojan') {
            const password = getProp(ob, ['password', 'auth']);
            if (!password) return null;
            
            const params = new URLSearchParams();
            if (sni) params.set('sni', sni);
            if (insecure === '1') params.set('allowInsecure', '1');
            
            const transport = getProp(ob, ['transport']) || {};
            const network = getProp(transport, ['type']) || getProp(ob, ['network', 'net']) || 'tcp';
            if (network && network !== 'tcp') params.set('type', network);
            
            const host = getProp(transport, ['headers'])?.Host || getProp(ob, ['host', 'ws-headers'])?.Host;
            const path = getProp(transport, ['path']) || getProp(ob, ['path', 'ws-path']);
            if (host) params.set('host', host);
            if (path) params.set('path', path);
            
            const link = `trojan://${encodeURIComponent(password)}@${server}:${port}?${params}#${encodeURIComponent(tag)}`;
            return { l: link, p: 'trojan', n: tag };
        }
        
        // --- Shadowsocks ---
        if (type === 'shadowsocks' || type === 'ss') {
            const method = getProp(ob, ['method', 'cipher']);
            const password = getProp(ob, ['password']);
            if (method && password) {
                const auth = `${method}:${password}`;
                const link = `ss://${safeBtoa(auth)}@${server}:${port}#${encodeURIComponent(tag)}`;
                return { l: link, p: 'ss', n: tag };
            }
        }

    } catch(e) {
        console.error(`Error parsing ${type} node:`, e);
    }
    
    return null;
}

function parseXrayChild(protocol, vChild, streamSettings) {
    if (!vChild.address || !vChild.port) return null;
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
    if (streamSettings) {
        node.network = streamSettings.network;
        if (streamSettings.security === 'tls') {
             node.tls = { enabled: true, server_name: streamSettings.tlsSettings?.serverName };
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
    
    // Hysteria2 链接模式
    const hysteria2Regex = /hysteria2:\/\/[^@]+@[^\s"',;<>]+/g;
    const hysteria2Matches = text.match(hysteria2Regex);
    if (hysteria2Matches) {
        hysteria2Matches.forEach(link => {
            try {
                const clean = link.split(/[\s"';<>,]/)[0];
                const nameMatch = clean.match(/#([^#]+)$/);
                const name = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Hysteria2-Node';
                nodes.push({ l: clean, p: 'hysteria2', n: name });
            } catch(e) {}
        });
    }
    
    // Hysteria 链接模式
    const hysteriaRegex = /hysteria:\/\/[^\s"',;<>]+/g;
    const hysteriaMatches = text.match(hysteriaRegex);
    if (hysteriaMatches) {
        hysteriaMatches.forEach(link => {
            try {
                const clean = link.split(/[\s"';<>,]/)[0];
                const nameMatch = clean.match(/#([^#]+)$/);
                const name = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Hysteria-Node';
                nodes.push({ l: clean, p: 'hysteria', n: name });
            } catch(e) {}
        });
    }
    
    // 其他协议
    const regex = /(vmess|vless|trojan|ss):\/\/[^\s"',;<>]+/g;
    const matches = text.match(regex);
    if (!matches) return nodes;

    matches.forEach(link => {
        try {
            let clean = link.split(/[\s"';<>,]/)[0];
            let type = clean.split(':')[0];
            let name = `${type}-Node`;
            if (clean.includes('#')) name = decodeURIComponent(clean.split('#')[1]);
            nodes.push({ l: clean, p: type, n: name });
        } catch(e){}
    });
    return nodes;
}

function safeBtoa(str) {
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1)));
    } catch (e) { 
        return btoa(str); 
    }
}

function safeAtob(str) {
    try {
        str = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        const decoded = atob(str);
        return decodeURIComponent(decoded.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    } catch (e) { 
        try { 
            return atob(str); 
        } catch(e2) { 
            return str; 
        }
    }
}
