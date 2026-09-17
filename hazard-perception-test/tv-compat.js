(function(w,d){
  'use strict';
  var p=String(w.navigator&&w.navigator.userAgent||'').toLowerCase();
  var tv=/smarttv|smart-tv|hbbtv|tizen|webos|web0s|netcast|googletv|google tv|android tv|bravia|vidaa|viera|aquos|roku/i.test(p);
  if(tv && d.documentElement.className.indexOf('tv-safe')<0) d.documentElement.className += ' tv-safe';
  if(!Array.from) Array.from=function(a){return Array.prototype.slice.call(a);};
  if(!Array.prototype.findIndex) Array.prototype.findIndex=function(fn){for(var i=0;i<this.length;i++)if(fn(this[i],i,this))return i;return -1;};
  if(!Array.prototype.find) Array.prototype.find=function(fn){for(var i=0;i<this.length;i++)if(fn(this[i],i,this))return this[i];return undefined;};
  if(!Array.prototype.flatMap) Array.prototype.flatMap=function(fn){var out=[];for(var i=0;i<this.length;i++){var r=fn(this[i],i,this);if(Array.isArray(r))for(var j=0;j<r.length;j++)out.push(r[j]);else out.push(r);}return out;};
  if(!String.prototype.padStart) String.prototype.padStart=function(n,ch){var s=String(this),c=ch===undefined?' ':String(ch);while(s.length<n)s=c+s;return s.slice(-n);};
  if(!String.prototype.startsWith) String.prototype.startsWith=function(x,p){p=p||0;return this.slice(p,p+String(x).length)===String(x);};
  if(!String.prototype.endsWith) String.prototype.endsWith=function(x){var s=String(x);return this.slice(-s.length)===s;};
  if(!NodeList.prototype.forEach) NodeList.prototype.forEach=Array.prototype.forEach;
  if(!Element.prototype.remove) Element.prototype.remove=function(){if(this.parentNode)this.parentNode.removeChild(this);};
  if(!w.requestAnimationFrame) w.requestAnimationFrame=function(cb){return w.setTimeout(function(){cb(new Date().getTime());},16);};
  if(!w.cancelAnimationFrame) w.cancelAnimationFrame=function(id){w.clearTimeout(id);};
  if(!w.performance) w.performance={};
  if(!w.performance.now) w.performance.now=function(){return new Date().getTime();};
  if(!w.Promise){
    var P=function(executor){var self=this;self.state=0;self.value=undefined;self.handlers=[];function fulfill(v){if(self.state)return;self.state=1;self.value=v;drain();}function reject(e){if(self.state)return;self.state=2;self.value=e;drain();}function drain(){w.setTimeout(function(){var hs=self.handlers.splice(0);for(var i=0;i<hs.length;i++)handle(hs[i]);},0);}function handle(h){if(self.state===0){self.handlers.push(h);return}var cb=self.state===1?h.ok:h.bad;if(!cb){(self.state===1?h.resolve:h.reject)(self.value);return}try{h.resolve(cb(self.value));}catch(e){h.reject(e)}}self.then=function(ok,bad){return new P(function(resolve,reject){handle({ok:ok,bad:bad,resolve:resolve,reject:reject});});};self.catch=function(bad){return self.then(null,bad);};try{executor(fulfill,reject);}catch(e){reject(e);}};
    P.resolve=function(v){return v&&typeof v.then==='function'?v:new P(function(r){r(v);});};
    P.reject=function(e){return new P(function(_,r){r(e);});};
    P.all=function(arr){return new P(function(resolve,reject){var a=Array.prototype.slice.call(arr||[]),out=[],left=a.length;if(!left)return resolve(out);function one(i){P.resolve(a[i]).then(function(v){out[i]=v;if(--left===0)resolve(out);},reject);}for(var i=0;i<a.length;i++)one(i);});};
    w.Promise=P;
  }
})(window,document);
