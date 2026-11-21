/**
 * A self-contained bookmarklet: click it on a TikTok, X, Instagram, Threads or
 * Bluesky post and it shows when the post was made, decoded from the URL.
 * Kept in plain ES2020 so it runs as a javascript: URL in any modern browser.
 */
export const BOOKMARKLET_SOURCE = `(()=>{const u=location.href,h=location.hostname,B=BigInt;let m,t;
if(/(^|\\.)(x|twitter)\\.com$/.test(h)&&(m=u.match(/\\/status(?:es)?\\/(\\d{5,20})/)))t=Number((B(m[1])>>22n)+1288834974657n);
else if(/tiktok\\.com$/.test(h)&&(m=u.match(/\\/(?:video|photo)\\/(\\d{15,21})/)))t=Number(B(m[1])>>32n)*1e3;
else if(/bsky\\.app$/.test(h)&&(m=u.match(/\\/post\\/([2-7a-z]{13})/))){let n=0n;for(const c of m[1])n=n*32n+B("234567abcdefghijklmnopqrstuvwxyz".indexOf(c));t=Number((n>>10n)/1000n)}
else if(/(instagram|threads)\\.(com|net)$/.test(h)&&(m=u.match(/\\/(?:p|reel|reels|tv|post)\\/([A-Za-z0-9_-]{5,})/))){let n=0n;for(const c of m[1].slice(0,11))n=n*64n+B("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".indexOf(c));t=Number((n>>23n)+1314220021721n)}
alert(t?"Posted "+new Date(t).toUTCString()+"\\nYour time: "+new Date(t).toLocaleString()+"\\n\\nDecoded from the post ID by FirstFrame":"FirstFrame: this URL has no post ID with a timestamp. Open a single post and try again.")})()`;

export const BOOKMARKLET = `javascript:${encodeURIComponent(BOOKMARKLET_SOURCE.replace(/\n/g, ""))}`;
