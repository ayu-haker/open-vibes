/* ======================================================================
   Open Vibes — Music API (via native NetBridge, no CORS)
   Real JioSaavn streaming + YouTube Music via Piped
   ====================================================================== */

var MusicAPI = (function() {
  'use strict';

  /* ===== NetBridge Promise wrapper (base64 decode) ===== */
  var _cbId = 0;
  var _cbs = {};

  window.NetBridge = window.NetBridge || {};

  NetBridge._resolve = function(id, data) {
    var cb = _cbs[id];
    if (cb) { cb.resolve(data); delete _cbs[id]; }
  };

  NetBridge._resolveB64 = function(id, b64) {
    var cb = _cbs[id];
    if (!cb) return;
    try {
      var json = decodeURIComponent(escape(atob(b64)));
      cb.resolve(json);
    } catch(e) {
      try { cb.resolve(atob(b64)); } catch(e2) { cb.reject(e2); }
    }
    delete _cbs[id];
  };

  NetBridge._reject = function(id, err) {
    var cb = _cbs[id];
    if (cb) { cb.reject(new Error(err)); delete _cbs[id]; }
  };

  function netFetch(url, headers) {
    return new Promise(function(resolve, reject) {
      var id = 'cb_' + (++_cbId);
      _cbs[id] = { resolve: resolve, reject: reject };
      try {
        if (headers) {
          NetBridge.fetchWithHeadersAsync(url, JSON.stringify(headers), id);
        } else {
          NetBridge.fetchAsync(url, id);
        }
      } catch (e) {
        delete _cbs[id];
        reject(e);
      }
    });
  }

  /* ===== DES-ECB decryption (JioSaavn URL decrypt) ===== */
  var DES = (function() {
    var IP=[58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
    var FP=[40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
    var E=[32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
    var P=[16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
    var PC1=[57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
    var PC2=[14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
    var SH=[1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
    var S1=[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13];
    var S2=[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9];
    var S3=[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12];
    var S4=[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14];
    var S5=[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3];
    var S6=[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13];
    var S7=[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12];
    var S8=[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,2,0,14,9,11,7,4,0,5,9,3,12,2,14,11,13,1,5,6,10,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9];
    var SS=[S1,S2,S3,S4,S5,S6,S7,S8];

    function bytesToBits(bytes){var b=[];for(var i=0;i<bytes.length;i++){for(var j=7;j>=0;j--)b.push((bytes[i]>>j)&1);}return b;}
    function permute(block,t){var r=[];for(var i=0;i<t.length;i++)r.push(block[t[i]-1]);return r;}
    function xor(a,b){var r=[];for(var i=0;i<a.length;i++)r.push(a[i]^b[i]);return r;}
    function sbox(inp,st){var row=inp[0]*2+inp[5];var col=inp[1]*8+inp[2]*4+inp[3]*2+inp[4];var v=st[row*16+col];return[(v>>3)&1,(v>>2)&1,(v>>1)&1,v&1];}

    function makeKeys(keyBytes){
      var bits=bytesToBits(keyBytes);
      var c=permute(bits,PC1).slice(0,28);
      var d=permute(bits,PC1).slice(28,56);
      var keys=[];
      for(var rd=0;rd<16;rd++){
        for(var s=0;s<SH[rd];s++){c.push(c.shift());d.push(d.shift());}
        var cd=c.concat(d);
        keys.push(permute(cd,PC2));
      }
      return keys;
    }

    function desBlock(block,keys){
      var bits=bytesToBits(block);
      var perm=permute(bits,IP);
      var L=perm.slice(0,32),R=perm.slice(32,64);
      for(var rd=0;rd<16;rd++){
        var ex=permute(R,E);
        var xored=xor(ex,keys[rd]);
        var sOut=[];
        for(var i=0;i<8;i++){sOut=sOut.concat(sbox(xored.slice(i*6,(i+1)*6),SS[i]));}
        var f=permute(sOut,P);
        var newR=xor(L,f);
        L=R; R=newR;
      }
      var combined=R.concat(L);
      var final=permute(combined,FP);
      var out=[];
      for(var i=0;i<8;i++){var byte=0;for(var j=0;j<8;j++)byte=(byte<<1)|final[i*8+j];out.push(byte);}
      return out;
    }

    function decryptBase64(b64,keyStr){
      var raw=atob(b64);
      var bytes=[];for(var i=0;i<raw.length;i++)bytes.push(raw.charCodeAt(i));
      var keyBytes=[];for(var i=0;i<keyStr.length;i++)keyBytes.push(keyStr.charCodeAt(i));
      var keys=makeKeys(keyBytes);
      var result=[];
      for(var i=0;i<bytes.length;i+=8){
        result=result.concat(desBlock(bytes.slice(i,i+8),keys));
      }
      var str='';for(var i=0;i<result.length;i++)str+=String.fromCharCode(result[i]);
      return str.replace(/\0+$/,'');
    }

    return { decrypt: decryptBase64 };
  })();

  /* ===== Helpers ===== */
  function decodeEntities(t){
    if(!t)return'';
    var e={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&apos;':"'",'&nbsp;':' '};
    return t.replace(/&[#\w]+;/g,function(m){if(e[m])return e[m];var d=m.match(/^&#(\d+);$/);if(d)return String.fromCharCode(parseInt(d[1]));var h=m.match(/^&#x([0-9a-fA-F]+);$/);if(h)return String.fromCharCode(parseInt(h[1],16));return m;});
  }
  function resolveImages(img){
    if(!img)return{small:'',thumbnail:'',large:''};
    var h=img.replace(/^http:\/\//,'https://');
    return{small:h.replace(/150x150|50x50/,'50x50'),thumbnail:h,large:h.replace(/150x150|50x50/,'500x500')};
  }

  /* ===== Cache ===== */
  var _sc={};var _stc={};
  function gc(k,c){var e=c[k];if(!e)return null;if(Date.now()>e.x){delete c[k];return null;}return e.v;}
  function sc(k,v,c,t){c[k]={v:v,x:Date.now()+t};}

  /* ===================================================================
     JIO SAAVN — Search + Stream URL (via native HTTP, no CORS proxy)
     =================================================================== */
  var JioSaavn=(function(){
    var API='https://www.jiosaavn.com/api.php';

    function buildUrl(ep,params){
      var u=new URL(API);
      u.searchParams.append('__call',ep);
      u.searchParams.append('_format','json');
      u.searchParams.append('_marker','0');
      u.searchParams.append('api_version','4');
      u.searchParams.append('ctx','web6dot0');
      for(var k in params)if(params.hasOwnProperty(k))u.searchParams.append(k,String(params[k]));
      return u.toString();
    }

    async function apiFetch(ep,params){
      var url=buildUrl(ep,params);
      var txt=await netFetch(url);
      if(!txt)throw new Error('Empty response');
      var data=typeof txt==='string'?JSON.parse(txt):txt;
      if(data&&data.error){
        var errMsg=typeof data.error==='object'?(data.error.msg||data.error.code||JSON.stringify(data.error)):String(data.error);
        throw new Error(errMsg);
      }
      return data;
    }

    function xformTrack(item){
      if(!item||!item.id)return null;
      var art='';
      try{
        var mi=item.more_info||{};
        var am=mi.artistMap||{};
        if(am.primary_artists&&am.primary_artists.length>0&&am.primary_artists[0].name){
          art=am.primary_artists[0].name;
        }else if(am.secondary_artists&&am.secondary_artists.length>0&&am.secondary_artists[0].name){
          art=am.secondary_artists[0].name;
        }else if(mi.singer&&mi.singer.length>0){
          art=mi.singer;
        }else if(item.artists&&item.artists.primary&&item.artists.primary.length>0){
          art=item.artists.primary[0].name;
        }
      }catch(e){}
      art=art||item.primary_artists||item.singer||'Unknown';
      var img=resolveImages(item.image||'');
      var encUrl=(item.more_info&&item.more_info.encrypted_media_url)||'';
      var dur=parseInt((item.more_info&&item.more_info.duration)||item.duration||'0')||0;
      var result={
        id:String(item.id||''),
        title:decodeEntities(item.title||item.song||''),
        artist:decodeEntities(art),
        albumTitle:decodeEntities((item.more_info&&item.more_info.album)||item.album||''),
        albumCover:img.large||img.thumbnail,
        thumbnail:img.thumbnail,
        duration:dur,
        source:'jiosaavn',
        encryptedMediaUrl:encUrl
      };
      return result;
    }

    function extractSongs(data){
      if(!data)return[];
      if(data.response&&Array.isArray(data.response.songs))return data.response.songs;
      if(data.songs&&Array.isArray(data.songs))return data.songs;
      if(data.results&&Array.isArray(data.results))return data.results;
      if(Array.isArray(data))return data;
      return[];
    }

    async function search(query,page,limit){
      page=page||1;limit=limit||20;
      var k='js_'+query+'_'+page;
      var cached=gc(k,_sc);if(cached)return cached;
      var data=await apiFetch('search.getResults',{q:query,p:page,n:limit});
      var songs=extractSongs(data);
      var tracks=songs.map(xformTrack).filter(Boolean);
      if(tracks.length>0)sc(k,tracks,_sc,3*60*1000);
      return tracks;
    }

    async function getStreamUrl(trackId,encUrl){
      if(encUrl&&typeof NetBridge!=='undefined'&&NetBridge.resolveStream){
        try{
          var url=await new Promise(function(resolve,reject){
            var id='ds_'+(window._dsId=(window._dsId||0)+1);
            _cbs[id]={resolve:resolve,reject:reject};
            try{NetBridge.resolveStream(encUrl,getQuality(),id);}catch(e){delete _cbs[id];reject(e);}
          });
          if(url&&url.startsWith('http'))return url;
        }catch(e){
          console.error('[JioSaavn] Native DES error:',e);
        }
      }
      if(encUrl){
        try{
          var dec=DES.decrypt(encUrl,'38346591');
          var quality=getQuality();
          var qMap={'Low (96kbps)':'_96','Normal (160kbps)':'_160','High (256kbps)':'_160','Very High (320kbps)':'_320','Lossless (FLAC)':'_320','96kbps':'_96','160kbps':'_160','320kbps':'_320'};
          var url=dec.replace('_96',qMap[quality]||'_320');
          if(url.startsWith('http'))return url;
        }catch(e){
          console.error('[JioSaavn] DES decrypt error:',e);
        }
      }
      var k='jst_'+trackId;
      var cached=gc(k,_stc);if(cached)return cached;
      try{
        var data=await apiFetch('song.getDetails',{pids:trackId});
        var songs=data.songs||data;
        if(Array.isArray(songs)&&songs.length>0){
          var song=songs[0];
          var enc=song.more_info&&song.more_info.encrypted_media_url;
          if(enc&&typeof NetBridge!=='undefined'&&NetBridge.resolveStream){
            var url=await new Promise(function(resolve,reject){
              var id='ds2_'+(window._dsId=(window._dsId||0)+1);
              _cbs[id]={resolve:resolve,reject:reject};
              try{NetBridge.resolveStream(enc,getQuality(),id);}catch(e){delete _cbs[id];reject(e);}
            });
            if(url&&url.startsWith('http')){
              sc(k,url,_stc,5*60*1000);
              return url;
            }
          }
          if(enc){
            var dec=DES.decrypt(enc,'38346591');
            var quality=getQuality();
            var qMap={'Low (96kbps)':'_96','Normal (160kbps)':'_160','High (256kbps)':'_160','Very High (320kbps)':'_320','Lossless (FLAC)':'_320','96kbps':'_96','160kbps':'_160','320kbps':'_320'};
            var url=dec.replace('_96',qMap[quality]||'_320');
            if(url.startsWith('http')){
              sc(k,url,_stc,5*60*1000);
              return url;
            }
          }
        }
      }catch(e){
        console.error('[JioSaavn] getDetails fallback error:',e);
      }
      throw new Error('Could not resolve stream URL');
    }

    async function getPopular(){
      var queries=[
        'top hindi songs 2024',
        'bollywood biggest hits',
        'trending india songs',
        'arijit singh best songs',
        'armaan malik hits',
        'new hindi songs',
        'hindi party songs',
        'romantic hindi songs'
      ];
      var allTracks=[];
      var pick=[];
      for(var i=0;i<3&&i<queries.length;i++){
        var ri=Math.floor(Math.random()*queries.length);
        if(pick.indexOf(ri)<0)pick.push(ri);else{ri=(ri+1)%queries.length;pick.push(ri);}
      }
      for(var i=0;i<pick.length;i++){
        try{
          var data=await apiFetch('search.getResults',{q:queries[pick[i]],p:1,n:10});
          var songs=extractSongs(data);
          allTracks=allTracks.concat(songs.map(xformTrack).filter(Boolean));
        }catch(e){
          console.error('[JioSaavn] getPopular query error:',e);
        }
      }
      var seen={};var unique=[];
      for(var i=0;i<allTracks.length;i++){
        if(!seen[allTracks[i].id]){seen[allTracks[i].id]=true;unique.push(allTracks[i]);}
      }
      return unique.slice(0,20);
    }

    async function getCharts(){
      var allTracks=[];
      var playlists=['bollywood butter','desi hip hop','punjabi hits','tamil top 10','telugu hits'];
      var q=playlists[Math.floor(Math.random()*playlists.length)];
      try{
        var data=await apiFetch('search.getResults',{q:q,p:1,n:15});
        var songs=extractSongs(data);
        allTracks=songs.map(xformTrack).filter(Boolean);
      }catch(e){
        console.error('[JioSaavn] getCharts error:',e);
      }
      return allTracks;
    }

    return{search:search,getStreamUrl:getStreamUrl,getPopular:getPopular,getCharts:getCharts};
  })();

  /* ===================================================================
     YOUTUBE MUSIC — via Piped instances (native HTTP)
     =================================================================== */
  var YTMusic=(function(){
    var INSTANCES=[
      'https://pipedapi.adminforge.de',
      'https://pipedapi.r4fo.com',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.leptons.xyz',
      'https://piapi.ggtyler.dev',
      'https://pipedapi.in.projectsegfau.lt',
      'https://api.piped.yt',
      'https://pipedapi.privacy.com.de'
    ];
    var lastOK=null;

    async function fetchAny(path){
      var list=lastOK?[lastOK]:INSTANCES;
      var err=null;
      for(var i=0;i<list.length;i++){
        try{
          var txt=await netFetch(list[i]+path);
          if(!txt)throw new Error('Empty');
          var data=typeof txt==='string'?JSON.parse(txt):txt;
          if(data.error&&typeof data.error==='string')throw new Error(data.error);
          lastOK=list[i];
          return data;
        }catch(e){
          if(list[i]===lastOK)lastOK=null;
          console.error('[YT] Failed '+list[i]+':',e.message);
          err=e;
        }
      }
      for(var i=0;i<INSTANCES.length;i++){
        if(list.indexOf(INSTANCES[i])>=0)continue;
        try{
          var txt=await netFetch(INSTANCES[i]+path);
          if(!txt)throw new Error('Empty');
          var data=typeof txt==='string'?JSON.parse(txt):txt;
          if(data.error&&typeof data.error==='string')throw new Error(data.error);
          lastOK=INSTANCES[i];
          return data;
        }catch(e){err=e;}
      }
      throw new Error('All Piped instances failed: '+(err?err.message:'unknown'));
    }

    function norm(item){
      var vid=item.videoId||item.id||'';
      var thumb=vid?'https://i.ytimg.com/vi/'+vid+'/hqdefault.jpg':'';
      return{
        id:vid,
        title:item.title||'Unknown',
        artist:item.uploaderName||item.author||'Unknown',
        albumTitle:'',
        albumCover:thumb,
        thumbnail:thumb,
        duration:item.duration||0,
        source:'ytmusic'
      };
    }

    async function search(query){
      var k='yt_'+query;
      var cached=gc(k,_sc);if(cached)return cached;
      var data=await fetchAny('/streams/search?q='+encodeURIComponent(query));
      var items=data.items||data||[];
      var seen={};var tracks=[];
      for(var i=0;i<items.length&&tracks.length<20;i++){
        var it=items[i];
        if(it.type!=='STREAM')continue;
        var vid=it.videoId||it.id;
        if(!vid||seen[vid])continue;
        seen[vid]=true;
        tracks.push(norm(it));
      }
      sc(k,tracks,_sc,3*60*1000);
      return tracks;
    }

    async function getStreamUrl(trackId){
      var k='yts_'+trackId;
      var cached=gc(k,_stc);if(cached)return cached;
      var data=await fetchAny('/streams/'+encodeURIComponent(trackId));
      var fmts=data.audioStreams||[];
      var best=null;
      for(var i=0;i<fmts.length;i++){
        var f=fmts[i];
        var mt=f.mimeType||f.type||'';
        if(!mt.startsWith('audio/'))continue;
        if(!best)best=f;
        var isMp4=mt.indexOf('audio/mp4')>=0;
        var bIsMp4=(best.mimeType||best.type||'').indexOf('audio/mp4')>=0;
        if(isMp4&&!bIsMp4)best=f;
        else if(isMp4===bIsMp4&&(f.bitrate||0)>(best.bitrate||0))best=f;
      }
      if(!best)throw new Error('No audio format');
      var url=best.url||'';
      if(!url&&best.itag){
        url=lastOK+'/latest_version?id='+encodeURIComponent(trackId)+'&itag='+best.itag+'&local=true';
      }
      if(!url)throw new Error('No URL');
      sc(k,url,_stc,5*60*1000);
      return url;
    }

    return{search:search,getStreamUrl:getStreamUrl};
  })();

  /* ===== Quality setting ===== */
  function getQuality(){return localStorage.getItem('ov_quality')||'320kbps';}
  function getProvider(){return localStorage.getItem('ov_provider')||'jiosaavn';}
  function setProvider(p){localStorage.setItem('ov_provider',p);}

  /* ===== Unified ===== */
  async function search(query){
    var prov=getProvider();
    if(prov==='ytmusic')return YTMusic.search(query);
    return JioSaavn.search(query);
  }

  async function getStreamUrl(trackId,track){
    var prov=(track&&track.source)||getProvider();
    if(prov==='ytmusic')return YTMusic.getStreamUrl(trackId);
    return JioSaavn.getStreamUrl(trackId,(track&&track.encryptedMediaUrl)||null);
  }

  async function getPopular(){return JioSaavn.getPopular();}
  async function getCharts(){return JioSaavn.getCharts();}

  /* Recently Played */
  function getRecent(){try{return JSON.parse(localStorage.getItem('ov_recent')||'[]');}catch(e){return[];}}
  function addRecent(track){
    var l=getRecent().filter(function(t){return t.id!==track.id;});
    l.unshift(track);if(l.length>30)l=l.slice(0,30);
    localStorage.setItem('ov_recent',JSON.stringify(l));
  }

  /* Favorites */
  function getFavorites(){try{return JSON.parse(localStorage.getItem('ov_favorites')||'[]');}catch(e){return[];}}
  function addFavorite(track){
    var l=getFavorites().filter(function(t){return t.id!==track.id;});
    l.unshift(track);
    localStorage.setItem('ov_favorites',JSON.stringify(l));
  }
  function removeFavorite(trackId){
    var l=getFavorites().filter(function(t){return t.id!==trackId;});
    localStorage.setItem('ov_favorites',JSON.stringify(l));
  }
  function isFavorite(trackId){
    return getFavorites().some(function(t){return t.id===trackId;});
  }

  return{
    search:search,getStreamUrl:getStreamUrl,getPopular:getPopular,getCharts:getCharts,
    getProvider:getProvider,setProvider:setProvider,getQuality:getQuality,
    getRecent:getRecent,addRecent:addRecent,
    getFavorites:getFavorites,addFavorite:addFavorite,removeFavorite:removeFavorite,isFavorite:isFavorite,
    JioSaavn:JioSaavn,YTMusic:YTMusic
  };
})();
