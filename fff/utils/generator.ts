import { ProxyNode } from "../types";

// 仅保留前端生成 Base64 的功能，供前端展示用
export const generateBase64Subscription = (nodes: ProxyNode[]): string => {
  const links = nodes.map(n => n.originalLink).filter(l => l).join('\n');
  try {
    return btoa(links);
  } catch (e) {
    return btoa(encodeURIComponent(links).replace(/%([0-9A-F]{2})/g,
        (match, p1) => String.fromCharCode(parseInt(p1, 16))));
  }
};