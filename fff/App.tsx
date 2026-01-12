import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Zap, Server, Activity, ShieldCheck, QrCode, Globe, Clock, CheckCircle2, AlertCircle, Copy, Check, Link as LinkIcon, AlertTriangle, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [deployDomain, setDeployDomain] = useState('');
  const [serverStatus, setServerStatus] = useState<{count: number, last_update: string, bot_ready: boolean, kv_ready?: boolean} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    // 客户端渲染时获取当前域名
    if (typeof window !== 'undefined' && window.location.origin) {
        setDeployDomain(window.location.origin);
        fetchStatus();
    }
  }, []);

  const fetchStatus = async () => {
      setIsLoading(true);
      setFetchError(false);
      try {
          // 获取后端状态
          const res = await fetch('/api/status');
          if (res.ok) {
              const text = await res.text();
              try {
                  const data = JSON.parse(text);
                  setServerStatus(data);
              } catch (e) {
                  // 如果返回的不是 JSON（可能是本地 Vite 返回的 index.html）
                  handleFetchError();
              }
          } else {
              handleFetchError();
          }
      } catch (e) {
          console.error("Failed to fetch status");
          handleFetchError();
      } finally {
          setIsLoading(false);
      }
  };

  const handleFetchError = () => {
      // 如果是本地开发环境，使用模拟数据
      // @ts-ignore: Fix for property 'env' does not exist on type 'ImportMeta' without needing extra d.ts
      if ((import.meta as any).env.DEV) {
          console.log("Running in DEV mode, using mock data.");
          setServerStatus({
              count: 999,
              last_update: 'Local Dev Mode',
              bot_ready: true,
              kv_ready: true
          });
          setFetchError(false);
      } else {
          setServerStatus(null);
          setFetchError(true);
      }
  };

  const getSubLink = (path: string) => {
      if (!deployDomain) return '';
      const base = deployDomain.endsWith('/') ? deployDomain.slice(0, -1) : deployDomain;
      return `${base}/${path}`;
  };

  const handleCopy = (path: string) => {
      const link = getSubLink(path);
      if (!link) return;
      navigator.clipboard.writeText(link).then(() => {
          setCopiedPath(path);
          setTimeout(() => setCopiedPath(null), 2000);
      });
  };

  const handleBindWebhook = () => {
      window.open('/webhook', '_blank');
  };

  const qrValue = deployDomain ? getSubLink('all') : '';

  // 状态辅助判断
  const isSystemOnline = serverStatus && !fetchError;
  const isBotReady = serverStatus?.bot_ready;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-20 selection:bg-blue-500/30">
      
      {/* 顶部导航 */}
      <header className="border-b border-gray-800 bg-[#0f172a]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/50">
              <Zap className="text-white h-5 w-5" />
            </div>
            <h1 className="font-bold text-lg text-white tracking-tight">SubLink Aggregator</h1>
          </div>
          <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border transition-colors ${
              isSystemOnline 
                ? 'text-green-400 bg-green-500/10 border-green-500/20' 
                : 'text-red-400 bg-red-500/10 border-red-500/20'
          }`}>
             <div className={`w-2 h-2 rounded-full ${isSystemOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
             {isLoading ? 'CONNECTING...' : (isSystemOnline ? 'SYSTEM ONLINE' : 'DISCONNECTED')}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        
        {/* 错误提示：仅在非开发模式下显示错误 */}
        {fetchError && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-orange-400 shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                    <h3 className="font-bold text-orange-200 mb-1">后端连接失败</h3>
                    <p className="text-orange-300/80 leading-relaxed">
                        无法连接到 Functions 后端。如果您正在本地运行 <code>npm run dev</code>，这是正常现象，因为 Vite 不支持 Cloudflare Functions。
                        <br/>
                        请使用 <code>npx wrangler pages dev dist</code> 进行本地测试，或部署到 Cloudflare Pages 查看效果。
                    </p>
                </div>
            </div>
        )}

        {/* 状态卡片区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 节点计数卡片 */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-xl group hover:border-blue-500/30 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Server size={80} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <Activity size={16} className="text-blue-400"/>
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">当前可用节点</h3>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-5xl font-bold text-white tracking-tight">
                        {serverStatus ? serverStatus.count : '--'}
                    </span>
                    <span className="text-sm text-gray-500">个</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 bg-gray-900/50 w-fit px-2 py-1 rounded border border-gray-800/50">
                    <Clock size={12} />
                    更新于: {serverStatus?.last_update || '未知'}
                </div>
            </div>

            {/* Bot 状态卡片 */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-xl group hover:border-green-500/30 transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ShieldCheck size={80} />
                </div>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Globe size={16} className="text-green-400"/>
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">控制中心</h3>
                    </div>
                    {/* 绑定 Webhook 按钮 */}
                    {isBotReady && (
                        <button 
                            onClick={handleBindWebhook}
                            className="text-[10px] bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                            title="点击此按钮激活 Bot (绑定 Webhook)"
                        >
                            <LinkIcon size={10} /> 绑定 Webhook
                        </button>
                    )}
                </div>
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                         <div className={`p-1.5 rounded-full ${isBotReady ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                             {isBotReady ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                         </div>
                         <div className="flex flex-col">
                             <span className={`text-sm font-medium ${isBotReady ? 'text-gray-300' : 'text-red-300'}`}>
                                 {fetchError ? '连接失败' : (isBotReady ? 'Bot Token 已配置' : 'Token 未配置')}
                             </span>
                             {/* 如果 Token 未配置但没有报错，提示用户重新部署 */}
                             {!isBotReady && !fetchError && (
                                 <span className="text-[10px] text-orange-400 flex items-center gap-1">
                                     <RefreshCw size={10}/> 添加变量后需<b>重新部署</b>
                                 </span>
                             )}
                         </div>
                    </div>
                    {/* KV 状态检查 */}
                    {serverStatus && serverStatus.kv_ready === false && (
                         <div className="flex items-center gap-3">
                             <div className="p-1.5 rounded-full bg-red-500/10 text-red-400">
                                 <AlertCircle size={18}/>
                             </div>
                             <span className="text-sm font-medium text-red-300">
                                 KV 未绑定 (重要)
                             </span>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 leading-relaxed pl-9">
                        {isBotReady 
                            ? '配置成功。请点击右上角 "绑定 Webhook" 按钮，然后向 Bot 发送 /start 开始使用。' 
                            : fetchError 
                                ? '请确保 Functions 已正确部署且运行中。'
                                : 'Cloudflare 环境变量非实时生效。请添加 TG_TOKEN 后，在 Pages 后台点击 "Retry deployment"。'}
                    </p>
                </div>
            </div>
        </div>

        {/* 订阅管理区 */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2 bg-gray-900/80">
                <QrCode size={18} className="text-blue-400"/>
                <h3 className="font-bold text-gray-200">订阅管理</h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 二维码展示 */}
                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-lg shadow-black/20">
                    {qrValue && !fetchError ? (
                        <QRCode 
                            value={qrValue} 
                            size={180}
                            level="M"
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                    ) : (
                         <div className="w-[180px] h-[180px] bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                             <AlertCircle size={24} className="opacity-50"/>
                             <span>{fetchError ? 'Service Unavailable' : 'Loading...'}</span>
                         </div>
                    )}
                    <p className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">通用订阅 (Universal)</p>
                </div>

                {/* 订阅链接列表 */}
                <div className="space-y-4 flex flex-col justify-center">
                    <p className="text-sm text-gray-400 mb-2">
                        点击右侧按钮复制链接，然后在 v2rayNG, Shadowrocket 或 Clash 中添加订阅。
                    </p>
                    
                    {[
                        { label: '全部节点 (推荐)', path: 'all', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
                        { label: 'VLESS 专线', path: 'vless', color: 'text-teal-300 border-teal-500/30 bg-teal-500/10' },
                        { label: 'Hysteria2 低延迟', path: 'hysteria2', color: 'text-pink-300 border-pink-500/30 bg-pink-500/10' },
                        { label: 'Clash 配置文件', path: 'clash', color: 'text-purple-300 border-purple-500/30 bg-purple-500/10' },
                    ].map((item) => (
                        <div key={item.path} className="group relative">
                            <div className="flex justify-between items-center text-xs text-gray-500 mb-1 px-1">
                                <span>{item.label}</span>
                            </div>
                            <div className={`flex items-center gap-3 p-3 rounded-lg border bg-gray-950 transition-all ${isSystemOnline ? 'border-gray-800 hover:border-gray-600' : 'border-red-900/30 opacity-50'}`}>
                                <div className={`px-2 py-1 rounded text-xs font-mono font-bold border ${item.color}`}>
                                    /{item.path}
                                </div>
                                <div className="flex-1 truncate text-xs font-mono text-gray-400 select-all">
                                    {getSubLink(item.path)}
                                </div>
                                <button 
                                    onClick={() => handleCopy(item.path)}
                                    className={`p-2 rounded-md transition-all duration-200 flex items-center justify-center w-8 h-8 ${
                                        copiedPath === item.path 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'hover:bg-gray-800 text-gray-400 hover:text-white'
                                    }`}
                                    title="复制链接"
                                >
                                    {copiedPath === item.path ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* 底部信息 */}
        <div className="text-center text-xs text-gray-600 py-6 border-t border-gray-800/50">
             <p className="mb-2">基于 Cloudflare Pages Functions 构建 · 无需外部服务器</p>
             <p className="opacity-50 font-mono">Build with React & Workers</p>
        </div>

      </main>
    </div>
  );
};

export default App;
