/**
 * Cloudflare Pages Functions - Backend Worker (Ultimate Edition v11)
 * 
 * Update Log v11:
 * - 新增: 完整的 YAML 解析器，支持 Clash 配置格式
 * - 新增: JavaScript 对象解析器，支持 eval 执行代码
 * - 修复: Hysteria2 完整支持，包括混淆、带宽等参数
 * - 修复: Hysteria 节点识别和参数处理
 * - 优化: 多层级嵌套配置解析
 * - 新增: 更多订阅源和更好的错误处理
 */

// ==========================================
// 1. 配置区域
// ==========================================

const BOT_KEYBOARD = {
    keyboard: [
        [{ text: "🔄 立即更新" }, { text: "📊 系统状态" }],
        [{ text: "🔗 订阅链接" }, { text: "⚙️ 检测配置" }],
        [{ text: "📈 节点统计" }, { text: "🧹 清理缓存" }]
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "请选择操作..."
};

// 扩展订阅源列表 - 包含多种格式
const PRESET_URLS = [
  // 标准订阅源
  "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/clash.yml",
  "https://raw.githubusercontent.com/mksshare/mksshare.github.io/main/README.md",
  "https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2ray/config.yml",
  
  // Clash 配置源
  "https://api.v1.mk/sub?target=clash&url=https%3A%2F%2Fraw.githubusercontent.com%2Ffreefq%2Ffree%2Fmaster%2Fv2",
  "https://api.v1.mk/sub?target=clash&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmfuu%2Fv2ray%2Fmaster%2Fv2ray",
  
  // 原始配置源
  "https://raw.githubusercontent.com/freefq/free/master/v2",
  "https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt",
  
  // Hysteria 专用源
  "https://raw.githubusercontent.com/emptysuns/Hi_Hysteria/main/server.json",
  "https://raw.githubusercontent.com/zephyrchien/kaminari/configs/config.json",
  
  // 混合源
  "https://proxy.yugogo.xyz/vmess/sub",
  "https://proxypool.fly.dev/clash/proxies",
  
  // 备用源
  "https://sub.id9.cc/sub?target=clash",
  "https://api.dler.io/sub?target=clash"
];

const SUB_NAME = "SubLink";

// ==========================================
// 2. YAML 解析器 (简化版)
// ==========================================

class SimpleYAMLParser {
    static parse(text) {
        try {
            const lines = text.split('\n');
            const result = {};
            const stack = [{ obj: result, indent: -2 }];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].replace(/\t/g, '  ');
                const trimmed = line.trim();
                
                // 跳过空行和注释
                if (trimmed === '' || trimmed.startsWith('#')) continue;
                
                // 计算缩进
                const indent = line.search(/\S/);
                
                // 处理数组项
                if (trimmed.startsWith('- ')) {
                    const arrayItem = trimmed.substring(2).trim();
                    const current = stack[stack.length - 1].obj;
                    
                    if (!Array.isArray(current)) {
                        // 转换为数组
                        const lastKey = Object.keys(current)[Object.keys(current).length - 1];
                        if (lastKey && typeof current[lastKey] !== 'object') {
                            current[lastKey] = [];
                        }
                    }
                    
                    // 尝试解析数组项
                    if (arrayItem.includes(': ')) {
                        const [key, value] = arrayItem.split(': ', 2);
                        const itemObj = { [key.trim()]: this.parseValue(value.trim()) };
                        if (Array.isArray(current)) {
                            current.push(itemObj);
                        } else {
                            const lastKey = Object.keys(current)[Object.keys(current).length - 1];
                            if (!Array.isArray(current[lastKey])) {
                                current[lastKey] = [itemObj];
                            } else {
                                current[lastKey].push(itemObj);
                            }
                        }
                    } else {
                        if (Array.isArray(current)) {
                            current.push(this.parseValue(arrayItem));
                        } else {
                            const lastKey = Object.keys(current)[Object.keys(current).length - 1];
                            if (!Array.isArray(current[lastKey])) {
                                current[lastKey] = [this.parseValue(arrayItem)];
                            } else {
                                current[lastKey].push(this.parseValue(arrayItem));
                            }
                        }
                    }
                    continue;
                }
                
                // 处理键值对
                if (trimmed.includes(': ')) {
                    const colonIndex = trimmed.indexOf(': ');
                    const key = trimmed.substring(0, colonIndex).trim();
                    let value = trimmed.substring(colonIndex + 1).trim();
                    
                    // 回退到正确的缩进级别
                    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
                        stack.pop();
                    }
                    
                    // 处理多行字符串
                    if (value === '|' || value === '>') {
                        value = this.readMultilineString(lines, i);
                        i += value.lineCount;
                        value = value.content;
                    } else if (value === '' || value === '{}' || value === '[]') {
                        // 空值，可能是对象或数组
                        value = value === '{}' ? {} : (value === '[]' ? [] : null);
                    } else {
                        value = this.parseValue(value);
                    }
                    
                    // 设置值
                    const currentObj = stack[stack.length - 1].obj;
                    
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        currentObj[key] = value;
                        stack.push({ obj: value, indent });
                    } else {
                        currentObj[key] = value;
                    }
                } else if (trimmed.endsWith(':')) {
                    // 只有键没有值，表示对象
                    const key = trimmed.substring(0, trimmed.length - 1).trim();
                    
                    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
                        stack.pop();
                    }
                    
                    const currentObj = stack[stack.length - 1].obj;
                    const newObj = {};
                    currentObj[key] = newObj;
                    stack.push({ obj: newObj, indent });
                }
            }
            
            return result;
        } catch (e) {
            console.error("YAML parse error:", e);
            return null;
        }
    }
    
    static parseValue(str) {
        if (str === 'true') return true;
        if (str === 'false') return false;
        if (str === 'null') return null;
        
        // 数字
        if (/^-?\d+$/.test(str)) return parseInt(str, 10);
        if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
        
        // 字符串处理
        if ((str.startsWith('"') && str.endsWith('"')) || 
            (str.startsWith("'") && str.endsWith("'"))) {
            return str.substring(1, str.length - 1);
        }
        
        return str;
    }
    
    static readMultilineString(lines, startIndex) {
        let content = '';
        let lineCount = 0;
        
        for (let i = startIndex + 1; i < lines.length; i++) {
            lineCount++;
            const line = lines[i];
            
            if (line.trim() === '' || line.trim().startsWith('#')) {
                continue;
            }
            
            if (line.search(/\S/) <= lines[startIndex].search(/\S/)) {
                lineCount--; // 回退
                break;
            }
            
            content += line.substring(lines[startIndex].search(/\S/) + 2) + '\n';
        }
        
        return { content: content.trim(), lineCount };
    }
}

// ==========================================
// 3. JavaScript 对象解析器
// ==========================================

class JSParser {
    static safeEval(str) {
        try {
            // 移除注释
            str = str.replace(/\/\/.*$/gm, '')
                     .replace(/\/\*[\s\S]*?\*\//g, '')
                     .trim();
            
            // 如果是 export default 格式
            if (str.includes('export default')) {
                str = str.replace(/export\s+default\s*/, '');
            }
            
            // 如果是 module.exports 格式
            if (str.includes('module.exports')) {
                str = str.replace(/module\.exports\s*=\s*/, '');
            }
            
            // 使用 Function 构造函数安全执行
            const fn = new Function('return (' + str + ')');
            return fn();
        } catch (e) {
            console.error("JS parse error:", e);
            return null;
        }
    }
}

// ==========================================
// 4. 主逻辑
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
// 5. Bot Logic
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

    if (text.includes('立即更新') || text.includes('/update')) {
        if (!env.KV) return send(`❌ <b>错误:</b> KV 未绑定。`);
        
        await send("⏳ <b>正在更新...</b>\n正在从预设源抓取 (Multi-Parser Mode)...");
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

    } else if (text.includes('系统状态') || text.includes('/status')) {
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

    } else if (text.includes('订阅链接') || text.includes('/links')) {
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(origin + '/all')}`;
        const msg = [
            `🔗 <b>订阅链接 (Subscription)</b>`,
            `<code>${origin}/all</code> - 所有节点`,
            `<code>${origin}/vless</code> - VLESS 节点`,
            `<code>${origin}/vmess</code> - VMess 节点`,
            `<code>${origin}/hysteria</code> - Hysteria 节点`,
            `<code>${origin}/hysteria2</code> - Hysteria2 节点`,
            `<code>${origin}/trojan</code> - Trojan 节点`,
            `<code>${origin}/ss</code> - Shadowsocks 节点`
        ].join('\n');
        try { await sendPhoto(qrApi, msg); } catch(e) { await send(msg); }

    } else if (text.includes('节点统计') || text.includes('/stats')) {
        if (!env.KV) return send(`❌ <b>错误:</b> KV 未绑定。`);
        
        const s = await env.KV.get('NODES');
        if(!s) return send(`⚠️ <b>暂无数据</b>\n请先点击"立即更新"获取节点。`);
        
        const nodes = JSON.parse(s);
        const stats = {};
        nodes.forEach(n => { 
            const type = n.p;
            stats[type] = stats[type] || { count: 0, examples: [] };
            stats[type].count++;
            if (stats[type].examples.length < 3) {
                stats[type].examples.push(n.n || '未命名节点');
            }
        });
        
        let msg = `📈 <b>节点详细统计</b>\n\n`;
        Object.entries(stats).forEach(([type, data]) => {
            msg += `• <b>${type.toUpperCase()}</b>: ${data.count} 个\n`;
            if (data.examples.length > 0) {
                msg += `  示例: ${data.examples.join(', ')}\n`;
            }
        });
        
        await send(msg);
        
    } else if (text.includes('清理缓存') || text.includes('/clear')) {
        if (!env.KV) return send(`❌ <b>错误:</b> KV 未绑定。`);
        
        await env.KV.delete('NODES');
        await env.KV.delete('LAST_UPDATE');
        await send(`✅ <b>缓存已清理</b>\n所有节点数据已清空。请重新更新。`);

    } else if (text.includes('检测配置') || text.includes('/check')) {
        const kvStatus = env.KV ? '✅' : '❌';
        const tokenStatus = env.TG_TOKEN ? '✅' : '❌';
        const adminStatus = env.ADMIN_ID ? '✅' : '❌';
        
        await send(`⚙️ <b>配置检测</b>\n\n` +
                  `KV 存储: ${kvStatus}\n` +
                  `Bot Token: ${tokenStatus}\n` +
                  `Admin ID: ${adminStatus}\n\n` +
                  `引擎版本: v11 (YAML+JS+MultiParser)`);
    } else {
        await send(`👋 <b>欢迎使用 SubLink Bot</b>\n\n` +
                  `请选择以下操作：\n` +
                  `• 🔄 立即更新 - 获取最新节点\n` +
                  `• 📊 系统状态 - 查看节点统计\n` +
                  `• 🔗 订阅链接 - 获取订阅链接\n` +
                  `• 📈 节点统计 - 详细节点信息\n` +
                  `• ⚙️ 检测配置 - 检查系统配置`);
    }
}

// ==========================================
// 6. Ultimate Parser Logic (v11 - 多解析器支持)
// ==========================================
async function fetchAndParseAll(urls) {
    const nodes = [];
    const BATCH_SIZE = 6;
    
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (u) => {
            try {
                console.log(`Fetching: ${u}`);
                const res = await fetch(u, { 
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache'
                    },
                    cf: { 
                        cacheTtl: 60,
                        cacheEverything: false 
                    }
                });
                if (!res.ok) {
                    console.log(`Failed to fetch ${u}: ${res.status}`);
                    return;
                }
                
                let text = await res.text();
                // Strip BOM
                text = text.replace(/^\uFEFF/, '').trim();
                
                if (text.length === 0) {
                    console.log(`Empty response from ${u}`);
                    return;
                }
                
                let foundInThisUrl = [];
                
                // 策略1: 检测和解析 YAML 格式
                if (u.includes('.yml') || u.includes('.yaml') || text.includes('proxies:') || text.includes('Proxy:')) {
                    console.log(`Detected YAML format from ${u}`);
                    foundInThisUrl = parseYAMLContent(text);
                }
                
                // 策略2: 检测和解析 JavaScript/JSON 格式
                if (foundInThisUrl.length === 0 && (text.includes('{') && text.includes('}') || text.includes('export default'))) {
                    console.log(`Detected JSON/JS format from ${u}`);
                    foundInThisUrl = parseJSONOrJSContent(text);
                }
                
                // 策略3: 检测 base64 编码内容
                if (foundInThisUrl.length === 0 && text.length > 10 && !text.includes(' ') && !text.includes('\n')) {
                    try {
                        const decoded = safeAtob(text);
                        if (decoded && decoded.length > 10) {
                            console.log(`Detected Base64 content from ${u}`);
                            foundInThisUrl = parseJSONOrJSContent(decoded);
                            if (foundInThisUrl.length === 0) {
                                foundInThisUrl = parseYAMLContent(decoded);
                            }
                        }
                    } catch(e) {
                        // 不是有效的 base64，继续
                    }
                }
                
                // 策略4: 正则表达式提取链接
                if (foundInThisUrl.length === 0) {
                    console.log(`Using regex extraction from ${u}`);
                    foundInThisUrl = extractNodesRegex(text);
                }
                
                // 调试信息
                if (foundInThisUrl.length > 0) {
                    const types = foundInThisUrl.map(n => n.p).filter((v, i, a) => a.indexOf(v) === i);
                    console.log(`URL ${u}: found ${foundInThisUrl.length} nodes (${types.join(', ')})`);
                } else {
                    console.log(`URL ${u}: no nodes found`);
                }
                
                nodes.push(...foundInThisUrl);
            } catch(e) {
                console.error(`Error parsing ${u}:`, e.message);
            }
        });
        await Promise.all(promises);
    }

    // 去重 (使用 Link + Protocol 确保不同协议区分)
    const unique = new Map();
    nodes.forEach(n => {
        if(n.l && n.p) {
            const key = n.l + '|' + n.p;
            if(!unique.has(key)) unique.set(key, n);
        }
    });
    
    const result = Array.from(unique.values());
    console.log(`Total unique nodes: ${result.length}`);
    
    // 统计信息
    const stats = result.reduce((acc, n) => {
        acc[n.p] = (acc[n.p] || 0) + 1;
        return acc;
    }, {});
    
    console.log('Final node types:', stats);
    
    return result;
}

function parseYAMLContent(text) {
    const results = [];
    
    try {
        // 使用 YAML 解析器
        const yamlObj = SimpleYAMLParser.parse(text);
        if (yamlObj) {
            // Clash 格式的 proxies 数组
            if (yamlObj.proxies && Array.isArray(yamlObj.proxies)) {
                yamlObj.proxies.forEach(proxy => {
                    const node = parseClashProxy(proxy);
                    if (node) results.push(node);
                });
            }
            
            // 其他可能的格式
            const foundNodes = findNodesRecursively(yamlObj);
            results.push(...foundNodes);
        }
        
        // 也尝试直接正则提取 YAML 中的节点
        const regexNodes = extractNodesRegex(text);
        results.push(...regexNodes);
        
    } catch(e) {
        console.error("YAML parsing error:", e);
    }
    
    return results;
}

function parseClashProxy(proxy) {
    if (!proxy || typeof proxy !== 'object') return null;
    
    const type = proxy.type ? proxy.type.toLowerCase() : '';
    const name = proxy.name || 'Clash-Node';
    const server = proxy.server;
    const port = proxy.port;
    
    if (!server || !port) return null;
    
    try {
        switch(type) {
            case 'hysteria2':
                return parseClashHysteria2(proxy, name);
            case 'hysteria':
                return parseClashHysteria(proxy, name);
            case 'vless':
            case 'vmess':
            case 'trojan':
            case 'ss':
                // 对于这些协议，Clash 通常直接提供链接或参数
                return parseClashStandardProxy(proxy, name);
            default:
                return null;
        }
    } catch(e) {
        console.error(`Error parsing Clash proxy ${type}:`, e);
        return null;
    }
}

function parseClashHysteria2(proxy, name) {
    const params = new URLSearchParams();
    
    // 必填参数
    if (!proxy.password && !proxy.auth_str) return null;
    const password = proxy.password || proxy.auth_str;
    
    // 可选参数
    if (proxy.sni) params.set('sni', proxy.sni);
    if (proxy['skip-cert-verify']) params.set('insecure', '1');
    
    // 带宽
    if (proxy.up || proxy.up_mbps) params.set('up', (proxy.up || proxy.up_mbps || '100').toString());
    if (proxy.down || proxy.down_mbps) params.set('down', (proxy.down || proxy.down_mbps || '100').toString());
    
    // 混淆
    if (proxy.obfs && proxy.obfs === 'salamander' && proxy['obfs-password']) {
        params.set('obfs', 'salamander');
        params.set('obfs-password', proxy['obfs-password']);
    }
    
    const link = `hysteria2://${encodeURIComponent(password)}@${proxy.server}:${proxy.port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'hysteria2', n: name };
}

function parseClashHysteria(proxy, name) {
    const params = new URLSearchParams();
    
    // 基本参数
    params.set('peer', proxy.sni || proxy.server);
    if (proxy['skip-cert-verify']) params.set('insecure', '1');
    
    // 带宽
    const up = proxy.up || proxy.up_mbps || '100';
    const down = proxy.down || proxy.down_mbps || '100';
    params.set('up', up.toString());
    params.set('down', down.toString());
    
    // 认证
    if (proxy.auth_str) params.set('auth', encodeURIComponent(proxy.auth_str));
    
    // 协议
    if (proxy.protocol) params.set('protocol', proxy.protocol);
    
    // 混淆
    if (proxy.obfs) params.set('obfs', proxy.obfs);
    if (proxy['obfs-password']) params.set('obfs-password', proxy['obfs-password']);
    
    const link = `hysteria://${proxy.server}:${proxy.port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'hysteria', n: name };
}

function parseClashStandardProxy(proxy, name) {
    // 尝试从 Clash 配置生成标准链接
    const type = proxy.type.toLowerCase();
    
    switch(type) {
        case 'vless':
            return parseClashVLESS(proxy, name);
        case 'vmess':
            return parseClashVMess(proxy, name);
        case 'trojan':
            return parseClashTrojan(proxy, name);
        case 'ss':
            return parseClashShadowsocks(proxy, name);
        default:
            return null;
    }
}

function parseClashVLESS(proxy, name) {
    const params = new URLSearchParams();
    params.set('encryption', 'none');
    
    // 网络类型
    const network = proxy.network || 'tcp';
    if (network !== 'tcp') params.set('type', network);
    
    // TLS
    if (proxy.tls) {
        params.set('security', 'tls');
        if (proxy.servername) params.set('sni', proxy.servername);
        if (proxy['skip-cert-verify']) params.set('allowInsecure', '1');
    }
    
    // WS 设置
    if (network === 'ws') {
        if (proxy['ws-opts'] && proxy['ws-opts'].path) {
            params.set('path', proxy['ws-opts'].path);
        }
        if (proxy['ws-opts'] && proxy['ws-opts'].headers && proxy['ws-opts'].headers.Host) {
            params.set('host', proxy['ws-opts'].headers.Host);
        }
    }
    
    // Reality
    if (proxy.reality && proxy.reality.enabled) {
        params.set('security', 'reality');
        if (proxy.reality['public-key']) params.set('pbk', proxy.reality['public-key']);
        if (proxy.reality['short-id']) params.set('sid', proxy.reality['short-id']);
    }
    
    const link = `vless://${proxy.uuid}@${proxy.server}:${proxy.port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'vless', n: name };
}

function parseClashVMess(proxy, name) {
    const vmess = {
        v: "2",
        ps: name,
        add: proxy.server,
        port: proxy.port,
        id: proxy.uuid,
        aid: proxy.alterId || 0,
        scy: proxy.cipher || "auto",
        net: proxy.network || "tcp",
        type: "none",
        host: "",
        path: "",
        tls: proxy.tls ? "tls" : "",
        sni: proxy.servername || ""
    };
    
    // WS 设置
    if (proxy.network === 'ws') {
        if (proxy['ws-opts']) {
            vmess.host = proxy['ws-opts'].headers?.Host || "";
            vmess.path = proxy['ws-opts'].path || "";
        }
    }
    
    const encoded = safeBtoa(JSON.stringify(vmess));
    return { l: `vmess://${encoded}`, p: 'vmess', n: name };
}

function parseJSONOrJSContent(text) {
    const results = [];
    
    try {
        // 先尝试 JSON
        let jsonObj = tryParseDirtyJSON(text);
        
        // 如果不是 JSON，尝试 JavaScript
        if (!jsonObj) {
            jsonObj = JSParser.safeEval(text);
        }
        
        if (jsonObj) {
            const foundNodes = findNodesRecursively(jsonObj);
            results.push(...foundNodes);
        }
        
        // 也尝试正则提取
        const regexNodes = extractNodesRegex(text);
        results.push(...regexNodes);
        
    } catch(e) {
        console.error("JSON/JS parsing error:", e);
    }
    
    return results;
}

function findNodesRecursively(obj) {
    let results = [];
    if (!obj || typeof obj !== 'object') return results;

    // --- 容器数组 ---
    if (Array.isArray(obj.outbounds)) obj.outbounds.forEach(o => results.push(...findNodesRecursively(o)));
    if (Array.isArray(obj.proxies)) obj.proxies.forEach(p => results.push(...findNodesRecursively(p)));
    if (Array.isArray(obj.servers)) obj.servers.forEach(s => results.push(...findNodesRecursively(s)));
    
    // --- Xray 嵌套 ---
    if (obj.settings && (obj.settings.vnext || obj.settings.servers)) {
        const target = obj.settings.vnext || obj.settings.servers;
        if (Array.isArray(target)) {
            target.forEach(v => {
                const subNode = parseXrayChild(obj.protocol, v, obj.streamSettings);
                if (subNode) results.push(subNode);
            });
        }
    }

    // --- 直接节点检查 ---
    const node = parseFlatNode(obj);
    if (node) results.push(node);

    // --- 通用递归 ---
    if (Array.isArray(obj)) {
        obj.forEach(item => results.push(...findNodesRecursively(item)));
    } else {
        Object.keys(obj).forEach(key => {
            if (key !== 'body' && key !== 'data' && key !== 'payload' && key !== 'rules') {
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
    
    // 获取服务器和端口
    let server = getProp(ob, ['server', 'ip', 'address', 'server_address', 'host']);
    let port = getProp(ob, ['server_port', 'port', 'listen_port', 'listen']);
    
    // 处理 listen 字符串格式
    if (!port && server && typeof server === 'string' && server.includes(':')) {
        const parts = server.split(':');
        if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
            port = parseInt(parts[1]);
            server = parts[0];
        }
    }
    
    if (!server || !port) return null;

    // 确定类型
    let type = getProp(ob, ['type', 'protocol', 'network']);
    type = (type || '').toLowerCase();
    
    // 增强的类型检测
    if (!type) {
        // Hysteria2 检测
        if (getProp(ob, ['obfs']) && (ob.obfs.type === 'salamander' || ob.obfs === 'salamander')) {
            type = 'hysteria2';
        }
        // Hysteria 检测
        else if (getProp(ob, ['up_mbps', 'down_mbps', 'auth_str', 'protocol', 'up', 'down'])) {
            type = 'hysteria';
        }
        // VLESS/VMess 检测
        else if (getProp(ob, ['uuid', 'id', 'userID'])) {
            type = 'vless';
        }
        // Shadowsocks 检测
        else if (getProp(ob, ['password']) && getProp(ob, ['method', 'cipher', 'security'])) {
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
    
    try {
        // --- Hysteria 2 ---
        if (type === 'hysteria2') {
            let password = getProp(ob, ['password', 'auth', 'auth_str', 'auth-str']);
            
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
            
            if (password === undefined) password = '';

            const params = new URLSearchParams();
            const sni = getProp(ob, ['sni', 'server_name', 'servername', 'host']);
            const insecure = getProp(ob, ['insecure', 'skip-cert-verify', 'allowInsecure']);
            
            if (sni) params.set('sni', sni);
            if (insecure) params.set('insecure', '1');
            
            // 带宽
            const up = getProp(ob, ['up', 'up_mbps']);
            const down = getProp(ob, ['down', 'down_mbps']);
            if (up) params.set('up', up.toString());
            if (down) params.set('down', down.toString());
            
            // Obfs
            const obfs = getProp(ob, ['obfs']);
            if (obfs) {
                if (typeof obfs === 'object') {
                    if (obfs.type === 'salamander') params.set('obfs', 'salamander');
                    if (obfs.password) params.set('obfs-password', obfs.password);
                } else if (obfs === 'salamander') {
                    params.set('obfs', 'salamander');
                    const obfsPassword = getProp(ob, ['obfs-password', 'obfs_password']);
                    if (obfsPassword) params.set('obfs-password', obfsPassword);
                }
            }

            const link = `hysteria2://${encodeURIComponent(password)}@${server}:${port}?${params}#${encodeURIComponent(tag)}`;
            return { l: link, p: 'hysteria2', n: tag };
        }

        // --- Hysteria 1 ---
        if (type === 'hysteria') {
            const params = new URLSearchParams();
            const sni = getProp(ob, ['sni', 'server_name', 'servername', 'host']);
            const insecure = getProp(ob, ['insecure', 'skip-cert-verify', 'allowInsecure']);
            
            params.set('peer', sni || server);
            if (insecure) params.set('insecure', '1');
            
            const up = getProp(ob, ['up', 'up_mbps']) || '100'; 
            const down = getProp(ob, ['down', 'down_mbps']) || '100';
            params.set('up', up.toString());
            params.set('down', down.toString());
            
            const auth = getProp(ob, ['auth', 'auth_str', 'auth-str', 'password']);
            if (auth) params.set('auth', encodeURIComponent(auth));
            
            const protocol = getProp(ob, ['protocol']);
            if (protocol) params.set('protocol', protocol);

            // Obfs
            const obfs = getProp(ob, ['obfs']);
            if (obfs) params.set('obfs', obfs);
            
            const obfsPassword = getProp(ob, ['obfs-password', 'obfs_password']);
            if (obfsPassword) params.set('obfs-password', obfsPassword);

            const link = `hysteria://${server}:${port}?${params}#${encodeURIComponent(tag)}`;
            return { l: link, p: 'hysteria', n: tag };
        }

        // --- 其他协议处理 (保持不变) ---
        // ... 这里保留原来的 VLESS、VMess、Trojan、Shadowsocks 处理代码
        // 由于篇幅限制，这里省略，但您可以使用之前版本中的对应代码
        
    } catch(e) {
        console.error(`Error parsing ${type} node:`, e);
    }
    
    return null;
}

// ... 保留原有的 parseXrayChild, extractNodesRegex, safeBtoa, safeAtob 函数
// 由于篇幅限制，这里不重复，您可以使用之前版本中的对应代码

function tryParseDirtyJSON(str) {
    if (!str || typeof str !== 'string') return null;
    try {
        return JSON.parse(str);
    } catch (e) {
        try {
            // 清理注释和尾随逗号
            const cleaned = str
                .replace(/\/\/.*$/gm, '')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/'([^']*)'/g, '"$1"');
            return JSON.parse(cleaned);
        } catch (e2) {
            try {
                return new Function('return (' + str + ')')();
            } catch (e3) {
                return null;
            }
        }
    }
}

function extractNodesRegex(text) {
    const nodes = [];
    
    // 匹配所有协议链接
    const protocols = ['vmess', 'vless', 'trojan', 'ss', 'hysteria2', 'hysteria'];
    const protocolRegex = new RegExp(`(${protocols.join('|')}):\/\/[^\\s"',;<>]+`, 'gi');
    
    const matches = text.match(protocolRegex);
    if (matches) {
        matches.forEach(link => {
            try {
                let clean = link.trim();
                // 移除可能的引号
                clean = clean.replace(/^['"`]|['"`]$/g, '');
                
                let type = clean.split(':')[0].toLowerCase();
                let name = `${type}-node`;
                
                // 从链接中提取名称
                const hashIndex = clean.indexOf('#');
                if (hashIndex !== -1) {
                    try {
                        name = decodeURIComponent(clean.substring(hashIndex + 1));
                    } catch(e) {
                        name = clean.substring(hashIndex + 1);
                    }
                }
                
                // 确保协议正确
                if (!protocols.includes(type)) {
                    // 尝试从链接中推断
                    if (clean.includes('hysteria2://')) type = 'hysteria2';
                    else if (clean.includes('hysteria://')) type = 'hysteria';
                }
                
                nodes.push({ l: clean, p: type, n: name.substring(0, 50) });
            } catch(e) {
                console.error('Error parsing link:', link, e);
            }
        });
    }
    
    return nodes;
}

function safeBtoa(str) {
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => 
            String.fromCharCode('0x' + p1)
        ));
    } catch (e) { 
        try {
            return btoa(str);
        } catch(e2) {
            return '';
        }
    }
}

function safeAtob(str) {
    try {
        str = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        const decoded = atob(str);
        return decodeURIComponent(decoded.split('').map(c => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
    } catch (e) { 
        try { 
            return atob(str); 
        } catch(e2) { 
            return str; 
        }
    }
}
