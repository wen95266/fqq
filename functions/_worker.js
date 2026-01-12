/**
 * Cloudflare Pages Functions - SubLink Ultimate v12
 * 完整的多协议订阅解析器，专门解决 Hysteria/Hysteria2 节点问题
 */

// ==========================================
// 1. 核心配置
// ==========================================

const BOT_KEYBOARD = {
    keyboard: [
        [{ text: "🔄 立即更新" }, { text: "📊 系统状态" }],
        [{ text: "🔗 订阅链接" }, { text: "⚙️ 检测配置" }],
        [{ text: "📈 节点统计" }, { text: "🧪 调试模式" }]
    ],
    resize_keyboard: true,
    is_persistent: true
};

// 专为 Hysteria/Hysteria2 优化的订阅源
const PRESET_URLS = [
  // Hysteria2 专用源
  "https://raw.githubusercontent.com/emptysuns/Hi_Hysteria/main/server.json",
  "https://hysteria.network/",
  "https://api.hysteria.network/config",
  
  // 混合订阅源（已知包含 Hysteria 节点）
  "https://raw.githubusercontent.com/freefq/free/master/v2",
  "https://raw.githubusercontent.com/mianfeifq/share/main/README.md",
  "https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2",
  "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
  "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/clash.yml",
  
  // 在线转换API
  "https://api.v1.mk/sub?target=clash&url=https://raw.githubusercontent.com/freefq/free/master/v2",
  "https://api.dler.io/sub?target=clash&insert=false&config=https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini",
  
  // 备用源
  "https://proxy.yugogo.xyz/vmess/sub",
  "https://proxypool.fly.dev/clash/proxies",
  "https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt",
  
  // 直连配置
  "https://hysteria2.net/config.json",
  "https://hysteria.net/config.json"
];

const SUB_NAME = "SubLink";

// ==========================================
// 2. 简化的 YAML 解析器
// ==========================================

class SimpleYAMLParser {
    static parse(text) {
        try {
            const lines = text.split('\n');
            const result = {};
            const stack = [{ obj: result, indent: -1 }];
            let inMultiLine = false;
            let multiLineKey = '';
            let multiLineContent = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                
                // 跳过注释和空行
                if (trimmed === '' || trimmed.startsWith('#')) continue;
                
                // 检查缩进
                const indent = line.search(/\S/);
                
                // 处理多行字符串
                if (inMultiLine) {
                    if (indent > stack[stack.length - 1].indent) {
                        multiLineContent += line.substring(stack[stack.length - 1].indent + 2) + '\n';
                        continue;
                    } else {
                        result[multiLineKey] = multiLineContent.trim();
                        inMultiLine = false;
                        multiLineKey = '';
                        multiLineContent = '';
                        i--; // 重新处理当前行
                        continue;
                    }
                }
                
                // 处理数组项
                if (trimmed.startsWith('- ')) {
                    const content = trimmed.substring(2).trim();
                    const current = stack[stack.length - 1].obj;
                    
                    // 如果是对象数组
                    if (content.includes(': ')) {
                        const [key, value] = content.split(': ', 2);
                        if (!Array.isArray(current)) {
                            // 将当前对象转换为数组
                            const keys = Object.keys(current);
                            const lastKey = keys[keys.length - 1];
                            if (lastKey && typeof current[lastKey] !== 'object') {
                                current[lastKey] = [];
                            }
                            current[lastKey].push({ [key.trim()]: this.parseValue(value.trim()) });
                        } else {
                            current.push({ [key.trim()]: this.parseValue(value.trim()) });
                        }
                    } else {
                        // 简单数组
                        const target = Array.isArray(current) ? current : current[Object.keys(current)[Object.keys(current).length - 1]];
                        if (Array.isArray(target)) {
                            target.push(this.parseValue(content));
                        }
                    }
                    continue;
                }
                
                // 处理键值对
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    let value = line.substring(colonIndex + 1).trim();
                    
                    // 调整堆栈
                    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
                        stack.pop();
                    }
                    
                    // 处理多行值
                    if (value === '|' || value === '>') {
                        inMultiLine = true;
                        multiLineKey = key;
                        multiLineContent = '';
                        stack[stack.length - 1].obj[key] = '';
                        continue;
                    }
                    
                    // 空值表示新对象
                    if (value === '' || value === '{}' || value === '[]') {
                        const newObj = value === '[]' ? [] : {};
                        stack[stack.length - 1].obj[key] = newObj;
                        stack.push({ obj: newObj, indent });
                    } else {
                        stack[stack.length - 1].obj[key] = this.parseValue(value);
                    }
                }
            }
            
            // 处理最后的多个行字符串
            if (inMultiLine) {
                result[multiLineKey] = multiLineContent.trim();
            }
            
            return result;
        } catch (e) {
            console.log("YAML parse error:", e.message);
            return null;
        }
    }
    
    static parseValue(str) {
        if (str === 'true') return true;
        if (str === 'false') return false;
        if (str === 'null') return null;
        if (/^-?\d+$/.test(str)) return parseInt(str, 10);
        if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
        
        // 处理引号包围的字符串
        if ((str.startsWith('"') && str.endsWith('"')) || 
            (str.startsWith("'") && str.endsWith("'"))) {
            return str.substring(1, str.length - 1);
        }
        
        return str;
    }
}

// ==========================================
// 3. 主函数
// ==========================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathPart = url.pathname.replace(/^\/|\/$/g, '').toLowerCase();

    // 静态资源放行
    if (!pathPart.startsWith('api/') && !['all', 'vless', 'vmess', 'trojan', 'hysteria', 'hysteria2', 'ss', 'sub', 'subscribe', 'webhook'].some(t => pathPart.includes(t))) {
        return env.ASSETS.fetch(request);
    }

    // Webhook 设置
    if (pathPart === 'webhook') {
      if (!env.TG_TOKEN) return new Response('❌ Error: TG_TOKEN not set.', { status: 500 });
      const webhookUrl = `${url.origin}/api/telegram`;
      const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/setWebhook?url=${webhookUrl}`);
      const j = await r.json();
      return new Response(`Webhook: ${webhookUrl}\nResult: ${JSON.stringify(j, null, 2)}`);
    }

    // Telegram Bot API
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

    // 状态 API
    if (pathPart === 'api/status') {
         let count = 0;
         let updateTime = null;
         try {
             if (env.KV) {
                 const stored = await env.KV.get('NODES');
                 if (stored) {
                     const nodes = JSON.parse(stored);
                     count = nodes.length;
                 }
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

    // 订阅输出
    let targetType = 'all';
    const queryType = url.searchParams.get('type');
    if (queryType) targetType = queryType.toLowerCase();
    
    // 路径推断
    if (pathPart.includes('hysteria2')) targetType = 'hysteria2';
    else if (pathPart.includes('hysteria')) targetType = 'hysteria';
    else if (pathPart.includes('vless')) targetType = 'vless';
    else if (pathPart.includes('vmess')) targetType = 'vmess';
    else if (pathPart.includes('trojan')) targetType = 'trojan';
    else if (pathPart.includes('ss')) targetType = 'ss';

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
    
    // 过滤无效节点
    filteredNodes = filteredNodes.filter(n => n && n.l && n.p);

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
// 4. Telegram Bot 逻辑
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
        
        await send("⏳ <b>正在更新...</b>\n使用多解析器深度扫描...");
        const start = Date.now();
        
        try {
            const nodes = await fetchAndParseAll(PRESET_URLS);
            
            if (nodes.length === 0) {
                return send(`⚠️ <b>警告:</b> 有效节点数为 0。\n请检查订阅源是否可用。`);
            }

            const stats = {};
            nodes.forEach(n => { 
                if (n && n.p) stats[n.p] = (stats[n.p] || 0) + 1; 
            });
            
            const statsStr = Object.entries(stats)
                .map(([k, v]) => `• <b>${k.toUpperCase()}</b>: ${v}`)
                .join('\n');

            await env.KV.put('NODES', JSON.stringify(nodes));
            const time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
            await env.KV.put('LAST_UPDATE', time);
            
            await send(`✅ <b>更新成功</b>\n\n📊 <b>节点总数:</b> ${nodes.length}\n${statsStr}\n\n⏱️ 耗时: ${((Date.now()-start)/1000).toFixed(1)}s\n🕒 时间: ${time}`);
        } catch (e) {
            await send(`❌ <b>更新失败:</b> ${e.message}\n\nStackTrace: ${e.stack}`);
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
                nodes.forEach(n => { 
                    if (n && n.p) stats[n.p] = (stats[n.p] || 0) + 1; 
                });
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
            `🔗 <b>订阅链接</b>`,
            `<code>${origin}/all</code> - 所有节点`,
            `<code>${origin}/hysteria</code> - Hysteria 节点`,
            `<code>${origin}/hysteria2</code> - Hysteria2 节点`,
            `<code>${origin}/vless</code> - VLESS 节点`,
            `<code>${origin}/vmess</code> - VMess 节点`
        ].join('\n');
        try { 
            await sendPhoto(qrApi, msg); 
        } catch(e) { 
            await send(msg); 
        }

    } else if (text.includes('节点统计') || text.includes('/stats')) {
        if (!env.KV) return send(`❌ <b>错误:</b> KV 未绑定。`);
        
        const s = await env.KV.get('NODES');
        if(!s) return send(`⚠️ <b>暂无数据</b>\n请先点击"立即更新"获取节点。`);
        
        const nodes = JSON.parse(s);
        const stats = {};
        nodes.forEach(n => { 
            if (n && n.p) {
                stats[n.p] = stats[n.p] || { count: 0, examples: [] };
                stats[n.p].count++;
                if (stats[n.p].examples.length < 2) {
                    stats[n.p].examples.push(n.n || n.l.substring(0, 30));
                }
            }
        });
        
        let msg = `📈 <b>节点详细统计</b>\n\n`;
        Object.entries(stats).forEach(([type, data]) => {
            msg += `<b>${type.toUpperCase()}</b>: ${data.count} 个\n`;
            if (data.examples.length > 0) {
                msg += `示例: ${data.examples.join(' | ')}\n`;
            }
            msg += '\n';
        });
        
        await send(msg);
        
    } else if (text.includes('调试模式') || text.includes('/debug')) {
        await send(`🔧 <b>调试信息</b>\n\n版本: v12 (Hysteria专用版)\n解析器: YAML+JSON+Regex\n订阅源: ${PRESET_URLS.length} 个\n优化: Hysteria/Hysteria2 优先`);

    } else if (text.includes('检测配置') || text.includes('/check')) {
        await send(`⚙️ <b>配置检测</b>\n\nKV: ${env.KV?'✅':'❌'}\nToken: ${env.TG_TOKEN?'✅':'❌'}\nAdmin: ${env.ADMIN_ID?'✅':'❌'}\n\n引擎: 多解析器模式`);

    } else {
        await send(`👋 <b>SubLink Bot</b>\n\n支持协议: Hysteria2, Hysteria, VLESS, VMess, Trojan, SS\n\n请选择操作:`);
    }
}

// ==========================================
// 5. 主要解析逻辑
// ==========================================
async function fetchAndParseAll(urls) {
    const allNodes = [];
    const errors = [];
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`处理源 ${i+1}/${urls.length}: ${url}`);
        
        try {
            const nodes = await parseSingleSource(url);
            if (nodes && nodes.length > 0) {
                console.log(`从 ${url} 找到 ${nodes.length} 个节点`);
                allNodes.push(...nodes);
            } else {
                console.log(`从 ${url} 未找到节点`);
                errors.push(`${url}: 无节点`);
            }
        } catch (e) {
            console.error(`解析 ${url} 失败:`, e.message);
            errors.push(`${url}: ${e.message}`);
        }
        
        // 延迟避免请求过快
        if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log(`总计找到 ${allNodes.length} 个节点`);
    console.log(`失败: ${errors.length} 个源`);
    
    // 去重
    const uniqueNodes = [];
    const seen = new Set();
    
    allNodes.forEach(node => {
        if (!node || !node.l || !node.p) return;
        
        const key = `${node.p}:${node.l}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueNodes.push(node);
        }
    });
    
    console.log(`去重后: ${uniqueNodes.length} 个节点`);
    
    // 节点类型统计
    const stats = {};
    uniqueNodes.forEach(n => {
        if (n && n.p) {
            stats[n.p] = (stats[n.p] || 0) + 1;
        }
    });
    console.log('节点类型统计:', stats);
    
    return uniqueNodes;
}

async function parseSingleSource(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            },
            timeout: 10000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        if (!text || text.trim() === '') {
            throw new Error('空响应');
        }
        
        console.log(`从 ${url} 获取到 ${text.length} 字符`);
        
        // 尝试多种解析方式
        const nodes = [];
        
        // 1. 尝试解析为 YAML
        const yamlNodes = parseAsYAML(text, url);
        if (yamlNodes.length > 0) {
            console.log(`YAML解析找到 ${yamlNodes.length} 个节点`);
            nodes.push(...yamlNodes);
        }
        
        // 2. 尝试解析为 JSON
        const jsonNodes = parseAsJSON(text, url);
        if (jsonNodes.length > 0) {
            console.log(`JSON解析找到 ${jsonNodes.length} 个节点`);
            nodes.push(...jsonNodes);
        }
        
        // 3. 尝试解析为 JavaScript
        const jsNodes = parseAsJavaScript(text, url);
        if (jsNodes.length > 0) {
            console.log(`JS解析找到 ${jsNodes.length} 个节点`);
            nodes.push(...jsNodes);
        }
        
        // 4. 尝试正则提取
        const regexNodes = extractWithRegex(text, url);
        if (regexNodes.length > 0) {
            console.log(`正则提取找到 ${regexNodes.length} 个节点`);
            nodes.push(...regexNodes);
        }
        
        // 5. 尝试 Base64 解码后解析
        const base64Nodes = parseAsBase64(text, url);
        if (base64Nodes.length > 0) {
            console.log(`Base64解析找到 ${base64Nodes.length} 个节点`);
            nodes.push(...base64Nodes);
        }
        
        return nodes;
        
    } catch (error) {
        console.error(`解析源 ${url} 失败:`, error.message);
        return [];
    }
}

function parseAsYAML(text, sourceUrl) {
    const nodes = [];
    
    try {
        // 检查是否是 YAML 格式
        if (!text.includes('proxies:') && !text.includes('Proxy:')) {
            return nodes;
        }
        
        const yaml = SimpleYAMLParser.parse(text);
        if (!yaml) return nodes;
        
        // 处理 Clash 格式
        if (yaml.proxies && Array.isArray(yaml.proxies)) {
            yaml.proxies.forEach(proxy => {
                const node = parseClashProxy(proxy, sourceUrl);
                if (node) nodes.push(node);
            });
        }
        
        // 递归查找其他可能的节点
        const foundNodes = findNodesInObject(yaml);
        nodes.push(...foundNodes);
        
    } catch (e) {
        console.log(`YAML解析失败: ${e.message}`);
    }
    
    return nodes;
}

function parseClashProxy(proxy, sourceUrl) {
    if (!proxy || typeof proxy !== 'object') return null;
    
    const type = (proxy.type || '').toLowerCase();
    const name = proxy.name || `${type}-node`;
    const server = proxy.server;
    const port = proxy.port;
    
    if (!server || !port) return null;
    
    try {
        switch(type) {
            case 'hysteria2':
                return parseHysteria2FromClash(proxy, name);
            case 'hysteria':
                return parseHysteriaFromClash(proxy, name);
            case 'vless':
                return parseVLESSFromClash(proxy, name);
            case 'vmess':
                return parseVMessFromClash(proxy, name);
            case 'trojan':
                return parseTrojanFromClash(proxy, name);
            case 'ss':
            case 'shadowsocks':
                return parseSSFromClash(proxy, name);
            default:
                return null;
        }
    } catch (e) {
        console.log(`解析Clash代理 ${type} 失败:`, e);
        return null;
    }
}

function parseHysteria2FromClash(proxy, name) {
    const params = new URLSearchParams();
    
    // 必需参数
    const password = proxy.password || proxy.auth_str || '';
    
    // 可选参数
    if (proxy.sni) params.set('sni', proxy.sni);
    if (proxy['skip-cert-verify']) params.set('insecure', '1');
    
    // 带宽
    const up = proxy.up || proxy.up_mbps || '100';
    const down = proxy.down || proxy.down_mbps || '100';
    params.set('up', up.toString());
    params.set('down', down.toString());
    
    // 混淆
    if (proxy.obfs === 'salamander' && proxy['obfs-password']) {
        params.set('obfs', 'salamander');
        params.set('obfs-password', proxy['obfs-password']);
    }
    
    const link = `hysteria2://${encodeURIComponent(password)}@${proxy.server}:${proxy.port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'hysteria2', n: name };
}

function parseHysteriaFromClash(proxy, name) {
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

// 其他协议解析函数（VLESS、VMess、Trojan、SS）
// 由于篇幅限制，这里提供简化版

function parseVLESSFromClash(proxy, name) {
    const params = new URLSearchParams();
    params.set('encryption', 'none');
    
    const network = proxy.network || 'tcp';
    if (network !== 'tcp') params.set('type', network);
    
    if (proxy.tls) {
        params.set('security', 'tls');
        if (proxy.servername) params.set('sni', proxy.servername);
        if (proxy['skip-cert-verify']) params.set('allowInsecure', '1');
    }
    
    if (network === 'ws' && proxy['ws-opts']) {
        if (proxy['ws-opts'].path) params.set('path', proxy['ws-opts'].path);
        if (proxy['ws-opts'].headers?.Host) params.set('host', proxy['ws-opts'].headers.Host);
    }
    
    const link = `vless://${proxy.uuid}@${proxy.server}:${proxy.port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'vless', n: name };
}

function parseVMessFromClash(proxy, name) {
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
    
    if (proxy.network === 'ws' && proxy['ws-opts']) {
        vmess.host = proxy['ws-opts'].headers?.Host || "";
        vmess.path = proxy['ws-opts'].path || "";
    }
    
    const encoded = safeBtoa(JSON.stringify(vmess));
    return { l: `vmess://${encoded}`, p: 'vmess', n: name };
}

function parseTrojanFromClash(proxy, name) {
    const params = new URLSearchParams();
    
    if (proxy.servername) params.set('sni', proxy.servername);
    if (proxy['skip-cert-verify']) params.set('allowInsecure', '1');
    
    const network = proxy.network || 'tcp';
    if (network !== 'tcp') params.set('type', network);
    
    if (network === 'ws' && proxy['ws-opts']) {
        if (proxy['ws-opts'].path) params.set('path', proxy['ws-opts'].path);
        if (proxy['ws-opts'].headers?.Host) params.set('host', proxy['ws-opts'].headers.Host);
    }
    
    const link = `trojan://${encodeURIComponent(proxy.password)}@${proxy.server}:${proxy.port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'trojan', n: name };
}

function parseSSFromClash(proxy, name) {
    const method = proxy.cipher || 'aes-256-gcm';
    const password = proxy.password;
    
    if (!method || !password) return null;
    
    const auth = `${method}:${password}`;
    const link = `ss://${safeBtoa(auth)}@${proxy.server}:${proxy.port}#${encodeURIComponent(name)}`;
    return { l: link, p: 'ss', n: name };
}

function parseAsJSON(text, sourceUrl) {
    const nodes = [];
    
    try {
        // 清理文本
        let cleaned = text
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();
        
        // 尝试解析
        const data = JSON.parse(cleaned);
        if (!data) return nodes;
        
        // 查找节点
        const foundNodes = findNodesInObject(data);
        nodes.push(...foundNodes);
        
    } catch (e) {
        // 尝试宽松解析
        try {
            const data = new Function('return (' + text + ')')();
            if (data) {
                const foundNodes = findNodesInObject(data);
                nodes.push(...foundNodes);
            }
        } catch (e2) {
            console.log(`JSON解析失败: ${e.message}`);
        }
    }
    
    return nodes;
}

function parseAsJavaScript(text, sourceUrl) {
    const nodes = [];
    
    try {
        // 检查是否是 JavaScript 格式
        if (text.includes('export default') || text.includes('module.exports') || 
            (text.includes('function') && text.includes('return'))) {
            
            // 提取对象
            let objText = text;
            
            if (objText.includes('export default')) {
                objText = objText.split('export default')[1].trim();
            } else if (objText.includes('module.exports =')) {
                objText = objText.split('module.exports =')[1].trim();
            }
            
            // 移除最后的分号
            objText = objText.replace(/;[\s]*$/, '');
            
            // 尝试执行
            const data = new Function('return (' + objText + ')')();
            if (data) {
                const foundNodes = findNodesInObject(data);
                nodes.push(...foundNodes);
            }
        }
    } catch (e) {
        console.log(`JavaScript解析失败: ${e.message}`);
    }
    
    return nodes;
}

function parseAsBase64(text, sourceUrl) {
    const nodes = [];
    
    try {
        // 检查是否是 base64
        if (text.length > 10 && !text.includes(' ') && !text.includes('\n') && 
            !text.includes('{') && !text.includes('[')) {
            
            const decoded = safeAtob(text);
            if (decoded && decoded.length > 10) {
                // 尝试多种解析
                const yamlNodes = parseAsYAML(decoded, sourceUrl + ' (base64)');
                const jsonNodes = parseAsJSON(decoded, sourceUrl + ' (base64)');
                const regexNodes = extractWithRegex(decoded, sourceUrl + ' (base64)');
                
                nodes.push(...yamlNodes, ...jsonNodes, ...regexNodes);
            }
        }
    } catch (e) {
        console.log(`Base64解析失败: ${e.message}`);
    }
    
    return nodes;
}

function findNodesInObject(obj) {
    const nodes = [];
    
    if (!obj || typeof obj !== 'object') return nodes;
    
    // 检查当前对象是否是节点
    const node = extractNodeFromObject(obj);
    if (node) nodes.push(node);
    
    // 递归搜索
    if (Array.isArray(obj)) {
        obj.forEach(item => {
            nodes.push(...findNodesInObject(item));
        });
    } else {
        Object.values(obj).forEach(value => {
            if (value && typeof value === 'object') {
                nodes.push(...findNodesInObject(value));
            }
        });
    }
    
    return nodes;
}

function extractNodeFromObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    
    // 提取服务器和端口
    let server = obj.server || obj.address || obj.host || obj.ip;
    let port = obj.port || obj.server_port;
    
    // 处理 host:port 格式
    if (server && typeof server === 'string' && server.includes(':') && !server.includes('://')) {
        const parts = server.split(':');
        if (parts.length === 2 && !isNaN(parts[1])) {
            server = parts[0];
            port = parseInt(parts[1]);
        }
    }
    
    if (!server || !port) return null;
    
    // 确定类型
    let type = (obj.type || obj.protocol || '').toLowerCase();
    
    if (!type) {
        // 智能推断
        if (obj.uuid || obj.id) {
            type = 'vless';
            if (obj.alterId || obj.alter_id) type = 'vmess';
        } else if (obj.password && (obj.up_mbps || obj.down_mbps || obj.auth_str)) {
            type = 'hysteria';
            if (obj.obfs && obj.obfs.type === 'salamander') type = 'hysteria2';
        } else if (obj.password && obj.method) {
            type = 'ss';
        }
    }
    
    if (!type) return null;
    
    // 处理 Hysteria2
    if (type === 'hysteria2') {
        return createHysteria2Link(obj, server, port);
    }
    
    // 处理 Hysteria
    if (type === 'hysteria') {
        return createHysteriaLink(obj, server, port);
    }
    
    // 其他协议
    return null;
}

function createHysteria2Link(obj, server, port) {
    const params = new URLSearchParams();
    const name = obj.name || obj.ps || obj.tag || `hysteria2-${server}:${port}`;
    
    // 密码
    let password = obj.password || obj.auth_str || '';
    
    // 处理 users 数组
    if (!password && obj.users && Array.isArray(obj.users) && obj.users.length > 0) {
        const user = obj.users[0];
        password = user.password || user.auth || '';
    }
    
    // 基本参数
    if (obj.sni) params.set('sni', obj.sni);
    if (obj.insecure || obj['skip-cert-verify']) params.set('insecure', '1');
    
    // 带宽
    const up = obj.up || obj.up_mbps || '100';
    const down = obj.down || obj.down_mbps || '100';
    params.set('up', up.toString());
    params.set('down', down.toString());
    
    // 混淆
    if (obj.obfs) {
        if (obj.obfs.type === 'salamander' || obj.obfs === 'salamander') {
            params.set('obfs', 'salamander');
            const obfsPassword = obj.obfs.password || obj['obfs-password'];
            if (obfsPassword) params.set('obfs-password', obfsPassword);
        }
    }
    
    const link = `hysteria2://${encodeURIComponent(password)}@${server}:${port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'hysteria2', n: name };
}

function createHysteriaLink(obj, server, port) {
    const params = new URLSearchParams();
    const name = obj.name || obj.ps || obj.tag || `hysteria-${server}:${port}`;
    
    // 基本参数
    params.set('peer', obj.sni || server);
    if (obj.insecure || obj['skip-cert-verify']) params.set('insecure', '1');
    
    // 带宽
    const up = obj.up || obj.up_mbps || '100';
    const down = obj.down || obj.down_mbps || '100';
    params.set('up', up.toString());
    params.set('down', down.toString());
    
    // 认证
    if (obj.auth_str || obj.password) {
        params.set('auth', encodeURIComponent(obj.auth_str || obj.password));
    }
    
    // 协议
    if (obj.protocol) params.set('protocol', obj.protocol);
    
    // 混淆
    if (obj.obfs) params.set('obfs', obj.obfs);
    if (obj['obfs-password']) params.set('obfs-password', obj['obfs-password']);
    
    const link = `hysteria://${server}:${port}?${params}#${encodeURIComponent(name)}`;
    return { l: link, p: 'hysteria', n: name };
}

function extractWithRegex(text, sourceUrl) {
    const nodes = [];
    
    // Hysteria2 链接
    const hysteria2Regex = /hysteria2:\/\/[^@\s]+@[^\s"',;<>]+/gi;
    const hysteria2Matches = text.match(hysteria2Regex);
    if (hysteria2Matches) {
        hysteria2Matches.forEach(link => {
            try {
                const cleanLink = link.trim();
                const nameMatch = cleanLink.match(/#([^#]+)$/);
                const name = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Hysteria2-Node';
                nodes.push({ l: cleanLink, p: 'hysteria2', n: name });
            } catch(e) {}
        });
    }
    
    // Hysteria 链接
    const hysteriaRegex = /hysteria:\/\/[^\s"',;<>]+/gi;
    const hysteriaMatches = text.match(hysteriaRegex);
    if (hysteriaMatches) {
        hysteriaMatches.forEach(link => {
            try {
                const cleanLink = link.trim();
                const nameMatch = cleanLink.match(/#([^#]+)$/);
                const name = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Hysteria-Node';
                nodes.push({ l: cleanLink, p: 'hysteria', n: name });
            } catch(e) {}
        });
    }
    
    // 其他协议链接
    const protocolRegex = /(vmess|vless|trojan|ss):\/\/[^\s"',;<>]+/gi;
    const protocolMatches = text.match(protocolRegex);
    if (protocolMatches) {
        protocolMatches.forEach(link => {
            try {
                const cleanLink = link.trim();
                const type = cleanLink.split(':')[0];
                const nameMatch = cleanLink.match(/#([^#]+)$/);
                const name = nameMatch ? decodeURIComponent(nameMatch[1]) : `${type}-node`;
                nodes.push({ l: cleanLink, p: type, n: name });
            } catch(e) {}
        });
    }
    
    return nodes;
}

// ==========================================
// 6. 工具函数
// ==========================================

function safeBtoa(str) {
    try {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, 
            (match, p1) => String.fromCharCode(parseInt(p1, 16))
        ));
    } catch (e) {
        return btoa(str);
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
        return atob(str);
    }
}
