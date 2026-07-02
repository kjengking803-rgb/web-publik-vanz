
/* =====================================================
   FIREBASE CONFIG
   ===================================================== */

function firebaseBaseUrl(){
  return String(FIREBASE_URL || '').trim().replace(/\/+$/,'');
}
function firebaseAuthQuery(prefix='?'){
  return FIREBASE_TOKEN ? `${prefix}auth=${encodeURIComponent(FIREBASE_TOKEN)}` : '';
}
async function dbGet(key){
  try{
    const localRaw=localStorage.getItem('yonz-cache-'+key);
    const url=`${firebaseBaseUrl()}/store/${key}.json${firebaseAuthQuery('?')}`;
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok){
      console.error('dbGet Firebase gagal:', r.status, r.statusText);
      return localRaw?JSON.parse(localRaw):null;
    }
    const d=await r.json();
    if(d!==null&&d!==undefined){
      try{localStorage.setItem('yonz-cache-'+key,JSON.stringify(d));}catch(e){}
      return d;
    }
    return localRaw?JSON.parse(localRaw):null;
  }catch(e){
    console.error('dbGet error:',e);
    try{const localRaw=localStorage.getItem('yonz-cache-'+key);return localRaw?JSON.parse(localRaw):null;}catch(_){return null;}
  }
}
async function dbSet(key,value){
  try{localStorage.setItem('yonz-cache-'+key,JSON.stringify(value));}catch(e){}
  try{
    const url=`${firebaseBaseUrl()}/store/${key}.json${firebaseAuthQuery('?')}`;
    const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
    if(!r.ok){console.error('dbSet Firebase gagal:', r.status, r.statusText);}
    return r.ok;
  }catch(e){console.error('dbSet error:',e);return false;}
}

// Helper: normalisasi data dari Firebase (bisa array atau object)
function normalizeArray(data){
  if(!data)return[];
  if(Array.isArray(data))return data;
  if(typeof data==='object')return Object.values(data);
  return[];
}

/* =====================================================
   CONSTANTS & STATE
   ===================================================== */
let ADMIN_WA='628132988940';
let GRUP_BUYER='https://chat.whatsapp.com/FSYs8eRrhtTC3INZ9gnv4D?mode=gi_t';
let STORE_NAME='Yonz Official';
let PRODUCT_LABEL='YONZ OFFICIAL';
let WA_DEFAULT_MESSAGE='Halo Admin Yonz Official, saya ingin bertanya / memesan produk 🙏';
let TELEGRAM_USER='';
let CS_CHANNELS={whatsapp:true,telegram:false};
let MUSIC_URL='';
let MUSIC_PLAYING=false;
let PAYMENT_CFG={
  dana:{active:true,no:'628132988940',name:''},
  gopay:{active:true,no:'628132988940',name:''},
  ovo:{active:true,no:'628132988940',name:''},
  qris:{active:true,url:'https://img2.pixhost.to/images/7311/716701404_alip-1776667419907.jpg',name:''},
  bank:{active:false,bankName:'',no:'',name:''},
  'wa-confirm':true,'show-all':true,afterMsg:'',
};
let selectedPayMethod=null;
let pendingOrderMsg='';
let pendingIsScript=false;
let activeIdx=null,activeVar=0;
let selectedVoucher=null;
let selectedStars=5;
let heroSlides=null;
let adMedia={imageOn:false,videoOn:false,imageUrl:'',videoUrl:'',title:'',subtitle:'',badge:'',btnLabel:''};
let currentSlide=0,sliderInterval=null;
const BG_CLASSES=['','bg2','bg3'];

// Per-product reviews: keyed by product id
let allProductReviews={};

const DEFAULT_PRODUCTS=[
  {id:'sewa-bot',cat:'bot-wa',title:'Sewa Bot',imgClass:'bot',imgTitle:'SEWA BOT EVERNIGHT MULTIDEVICE',imgUrl:'',price:'Rp500',available:'Tersedia hingga Rp40.000',desc:'Sewa bot untuk jaga grup anda yang memiliki 1800+ fitur aktif.',
   varians:[{name:'1 hari',price:'Rp500'},{name:'3 hari',price:'Rp2.000'},{name:'5 hari',price:'Rp3.500'},{name:'7 hari',price:'Rp4.000'},{name:'14 hari',price:'Rp6.000'},{name:'1 bulan',price:'Rp7.000'},{name:'3 bulan',price:'Rp26.000'},{name:'1 tahun',price:'Rp40.000'}],
   features:[{icon:'💬',name:'Bot WhatsApp',desc:'Bot aktif langsung di grup kamu'},{icon:'🔄',name:'Aktivasi Otomatis',desc:'Bot masuk grup setelah bayar'},{icon:'⚡',name:'Fitur Lengkap',desc:'1800+ command aktif'},{icon:'🛡️',name:'Support 24/7',desc:'CS siap bantu kapan saja'}]},
  {id:'panel',cat:'panel',title:'Panel Bot WA',imgClass:'panel',imgTitle:'PANEL PTERO PREMIUM',imgUrl:'',price:'Rp2.000',available:'Tersedia hingga Rp50.000',desc:'Panel pterodactyl premium menggunakan VPS legal, aktif hingga 1 bulan penuh.',
   varians:[{name:'1 minggu',price:'Rp2.000'},{name:'2 minggu',price:'Rp4.000'},{name:'1 bulan',price:'Rp7.000'},{name:'2 bulan',price:'Rp12.000'},{name:'Permanen',price:'Rp50.000'}],
   features:[{icon:'🖥️',name:'VPS Legal',desc:'VPS berlisensi resmi'},{icon:'⚡',name:'Performa Tinggi',desc:'Uptime 99.9% dijamin'},{icon:'🔒',name:'Aman & Stabil',desc:'Tidak pernah down sembarangan'},{icon:'🛡️',name:'Support 24/7',desc:'CS siap bantu kapan saja'}]},
  {id:'script',cat:'source-code',title:'SC Evernight Ai',imgClass:'sc',imgTitle:'EVERNIGHT MULTIDEVICE V10.5 — PREMIUM',imgUrl:'',price:'Rp75.000',available:'Tersedia: Unlimited',desc:'Scrip bot WhatsApp Evernight AI versi premium dengan 1800+ fitur lengkap siap pakai.',
   varians:[{name:'Download',price:'Rp75.000'}],
   features:[{icon:'📦',name:'Full Script',desc:'Kode lengkap tanpa enkripsi'},{icon:'🔄',name:'Update Gratis',desc:'Dapat update versi terbaru'},{icon:'⚙️',name:'1800+ Fitur',desc:'Menu all, game, fun, search, sticker'},{icon:'🛡️',name:'Support Setup',desc:'Bantuan instalasi oleh CS'}]}
];
let products=DEFAULT_PRODUCTS;

/* =====================================================
   REVIEWS PER PRODUK
   ===================================================== */
function getProductReviews(prodId){
  return allProductReviews[prodId]||[];
}

function getReviewStats(reviews){
  const total=reviews.length;
  if(!total)return{avg:5.0,total:0};
  const avg=Math.round((reviews.reduce((s,u)=>s+(u.stars||5),0)/total)*10)/10;
  return{avg,total};
}

async function loadAllProductReviews(){
  const data=await dbGet('store-product-reviews');
  if(data&&typeof data==='object'&&!Array.isArray(data))allProductReviews=data;
  else allProductReviews={};
}

async function saveProductReview(prodId,review){
  // Ambil ulang dulu supaya ulasan dari user lain tidak ketimpa.
  await loadAllProductReviews();
  if(!allProductReviews[prodId])allProductReviews[prodId]=[];
  allProductReviews[prodId].push(review);
  const ok=await dbSet('store-product-reviews',allProductReviews);
  return ok;
}

async function likeProductReview(prodId,idx){
  if(!allProductReviews[prodId]||idx<0||idx>=allProductReviews[prodId].length)return;
  allProductReviews[prodId][idx].likes=(allProductReviews[prodId][idx].likes||0)+1;
  await dbSet('store-product-reviews',allProductReviews);
}

/* =====================================================
   RENDER MINI REVIEWS (di card produk)
   ===================================================== */
function renderMiniReviews(prodId,container){
  const reviews=getProductReviews(prodId);
  const{avg,total}=getReviewStats(reviews);
  const last2=reviews.slice(-2).reverse();
  // FIX: cari prodIdx dengan aman, fallback ke -1 check
  const prodIdx=products.findIndex(p=>p.id===prodId);
  const openReviewsHandler=prodIdx>=0?`openProductReviewsModal(${prodIdx})`:'';
  const writeReviewHandler=prodIdx>=0?`openWriteReviewModal(${prodIdx})`:'';

  const miniDiv=document.createElement('div');
  miniDiv.className='card-reviews-mini';

  let html=`<div class="card-reviews-mini-title">
    <span>⭐ ${avg.toFixed(1)} (${total} ulasan)</span>
    ${openReviewsHandler?`<span class="see-all" onclick="event.stopPropagation();${openReviewsHandler}">Lihat semua →</span>`:''}
  </div>`;

  if(last2.length===0){
    html+=`<div class="mini-empty">Belum ada ulasan. Jadilah yang pertama! 🌟</div>`;
  }else{
    last2.forEach(r=>{
      const nama=escapeHtml(r.nama||'Anonim');
      const teks=escapeHtml(r.teks||'');
      html+=`<div class="mini-review-item">
        <div class="mini-review-av">${nama.charAt(0).toUpperCase()}</div>
        <div class="mini-review-content">
          <div class="mini-review-name">${nama} <span class="mini-review-stars">${'★'.repeat(r.stars||5)}</span></div>
          <div class="mini-review-text">${teks}</div>
        </div>
      </div>`;
    });
  }

  if(writeReviewHandler){
    html+=`<button class="btn-write-review" onclick="event.stopPropagation();${writeReviewHandler}">✏️ Tulis Ulasan</button>`;
  }

  miniDiv.innerHTML=html;
  container.appendChild(miniDiv);
}

/* =====================================================
   PRODUCT REVIEWS MODAL (in product detail)
   ===================================================== */
function renderProductReviewsSection(prodIdx){
  const p=products[prodIdx];
  const reviews=getProductReviews(p.id);
  const{avg,total}=getReviewStats(reviews);
  const starsHtml='★'.repeat(Math.round(avg))+'☆'.repeat(5-Math.round(avg));
  const section=document.getElementById('m-reviews-section');

  const bars=[5,4,3,2,1].map(s=>{
    const cnt=reviews.filter(u=>(u.stars||5)===s).length;
    const pct=total?Math.round(cnt/total*100):0;
    return{s,cnt,pct};
  });

  section.innerHTML=`
    <div class="vlabel" style="margin-top:4px">Ulasan Pembeli</div>
    <div class="prod-reviews-summary">
      <div style="text-align:center">
        <div class="prod-reviews-score">${avg.toFixed(1)}</div>
        <div class="prod-reviews-stars-big">${starsHtml}</div>
        <div class="prod-reviews-total">${total} ulasan</div>
      </div>
      <div class="prod-review-bars">
        ${bars.map(b=>`<div class="prod-review-bar-row">
          <span>${b.s}</span>
          <div class="prod-review-bar-track"><div class="prod-review-bar-fill" style="width:${b.pct}%"></div></div>
          <span>${b.cnt}</span>
        </div>`).join('')}
      </div>
    </div>
    <button class="btn-tulis-prod" onclick="openWriteReviewModal(${prodIdx})">✏️ Tulis Ulasan untuk Produk Ini</button>
    <div class="prod-review-divider">Ulasan Terbaru</div>
    ${total===0?`<div class="prod-reviews-empty"><div class="ei">📭</div>Belum ada ulasan. Jadilah yang pertama!</div>`:''}
    ${reviews.slice().reverse().map((r,i)=>`
      <div class="prod-review-card">
        <div class="prod-review-card-head">
          <div class="prod-review-av">${escapeHtml(r.nama||'A').charAt(0).toUpperCase()}</div>
          <div class="prod-review-meta">
            <div class="prod-review-nm">${escapeHtml(r.nama||'Anonim')} <span class="prod-review-verified">✓ Verified</span></div>
            <div class="prod-review-time">${escapeHtml(r.waktu||'Baru saja')}</div>
          </div>
          <div class="prod-review-stars">${'★'.repeat(r.stars||5)}</div>
        </div>
        <div class="prod-review-text">${escapeHtml(r.teks||'')}</div>
        <button class="prod-review-like" onclick="likeProductReviewAndRefresh(${prodIdx},${reviews.length-1-i})">👍 Membantu ${r.likes||0}</button>
      </div>`).join('')}`;
}

async function likeProductReviewAndRefresh(prodIdx,revIdx){
  const p=products[prodIdx];
  await likeProductReview(p.id,revIdx);
  renderProductReviewsSection(prodIdx);
  updateCardStars(p.id);
}

function openProductReviewsModal(prodIdx){
  openModal(prodIdx);
  setTimeout(()=>{
    const section=document.getElementById('m-reviews-section');
    if(section)section.scrollIntoView({behavior:'smooth',block:'start'});
  },350);
}

/* =====================================================
   WRITE REVIEW MODAL
   ===================================================== */
let reviewingProdIdx=null;

function openWriteReviewModal(prodIdx){
  reviewingProdIdx=prodIdx;
  selectedStars=5;
  // FIX: hanya tutup prod-overlay jika memang sedang terbuka
  const prodOverlay=document.getElementById('prod-overlay');
  if(prodOverlay.classList.contains('open')){
    prodOverlay.classList.remove('open');
  }

  document.getElementById('ulasan-overlay').classList.add('open');
  const body=document.getElementById('ulasan-body');
  const p=products[prodIdx];
  body.innerHTML=`
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <div style="font-size:20px">${p.cat==='bot-wa'?'💬':p.cat==='panel'?'🖥️':'📦'}</div>
      <div><div style="font-size:12px;font-weight:600;color:#fff">${escapeHtml(p.title)}</div><div style="font-size:10px;color:var(--muted)">${p.cat==='bot-wa'?'Bot WA':p.cat==='panel'?'Panel':p.cat==='source-code'?'Script':p.cat}</div></div>
    </div>
    <div class="fg">
      <label class="fl">Nama Kamu</label>
      <input class="fi" id="ul-nama" placeholder="Nama kamu..." maxlength="30">
    </div>
    <div class="fg">
      <label class="fl">Rating</label>
      <div class="star-picker" id="star-picker">
        <span onclick="setStars(1)">⭐</span>
        <span onclick="setStars(2)">⭐</span>
        <span onclick="setStars(3)">⭐</span>
        <span onclick="setStars(4)">⭐</span>
        <span onclick="setStars(5)">⭐</span>
      </div>
    </div>
    <div class="fg">
      <label class="fl">Ulasan</label>
      <textarea class="fta" id="ul-teks" placeholder="Ceritakan pengalamanmu dengan produk ini..." rows="3" style="min-height:80px"></textarea>
    </div>
    <button class="btn-order" onclick="submitProductReview()">📨 Kirim Ulasan</button>
    <button style="width:100%;margin-top:9px;padding:10px;background:none;border:1px solid var(--border);border-radius:9px;color:var(--muted);font-size:12px;cursor:pointer;font-family:Sora,sans-serif" onclick="closeUlasanModal()">Batal</button>`;
  updateStarPicker(5);
}

async function submitProductReview(){
  const nama=(document.getElementById('ul-nama').value||'').trim();
  const teks=(document.getElementById('ul-teks').value||'').trim();
  if(!nama||!teks){showToast('⚠️ Nama dan ulasan wajib diisi!');return;}
  const now=new Date();
  const waktu=`${now.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][now.getMonth()]} ${now.getFullYear()}`;
  const newR={nama,teks,stars:selectedStars,waktu,likes:0};
  const p=products[reviewingProdIdx];
  const saved=await saveProductReview(p.id,newR);
  if(saved){showToast('✅ Ulasan berhasil dikirim dan tersimpan!');}
  else{showToast('✅ Ulasan tersimpan di perangkat ini. Cek Firebase rules agar tersimpan online.');}
  closeUlasanModal();
  updateCardStars(p.id);
  setTimeout(()=>{openModal(reviewingProdIdx);},350);
}

function updateCardStars(prodId){
  const reviews=getProductReviews(prodId);
  const{avg,total}=getReviewStats(reviews);
  document.querySelectorAll(`.product-card[data-prodid="${prodId}"]`).forEach(card=>{
    const sc=card.querySelector('.star-count');
    const sr=card.querySelector('.star-review');
    if(sc)sc.textContent=` ${avg.toFixed(1)}`;
    if(sr)sr.textContent=` (${total})`;
    // Pastikan ulasan tidak muncul di menu utama setelah user mengirim ulasan.
    const oldMini=card.querySelector('.card-reviews-mini');
    if(oldMini) oldMini.remove();
  });
}

/* =====================================================
   GLOBAL ULASAN MODAL (semua produk)
   ===================================================== */
let ulasanData=[];
const DB_KEY_ULASAN='store-ulasan';

function openUlasanModal(){
  reviewingProdIdx=null;
  document.getElementById('ulasan-overlay').classList.add('open');
  loadGlobalUlasan();
}
function closeUlasanModal(){document.getElementById('ulasan-overlay').classList.remove('open');}

async function loadGlobalUlasan(){
  document.getElementById('ulasan-body').innerHTML=`<div style="text-align:center;padding:24px"><div style="font-size:22px;margin-bottom:8px">⭐</div><div style="font-size:12px;color:var(--muted)">Memuat ulasan...</div></div>`;
  const data=await dbGet(DB_KEY_ULASAN);
  ulasanData=normalizeArray(data);
  renderGlobalUlasanList();
}

function renderGlobalUlasanList(){
  const total=ulasanData.length;
  const avg=total?Math.round((ulasanData.reduce((s,u)=>s+(u.stars||5),0)/total)*10)/10:5.0;
  const starsHtml='★'.repeat(Math.round(avg))+'☆'.repeat(5-Math.round(avg));
  const body=document.getElementById('ulasan-body');
  body.innerHTML=`
    <div class="ulasan-stat">
      <div style="text-align:center">
        <div class="ulasan-score">${avg.toFixed(1)}</div>
        <div class="ulasan-stars-big">${starsHtml}</div>
        <div class="ulasan-total">${total} ulasan</div>
      </div>
      <div style="flex:1">
        ${[5,4,3,2,1].map(s=>{
          const cnt=ulasanData.filter(u=>(u.stars||5)===s).length;
          const pct=total?Math.round(cnt/total*100):0;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:10px;color:var(--muted);width:12px">${s}</span>
            <div style="flex:1;height:5px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--gold);border-radius:3px"></div></div>
            <span style="font-size:10px;color:var(--muted);width:14px">${cnt}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <button class="btn-tulis" onclick="showGlobalUlasanForm()">✏️ Tulis Ulasan</button>
    <div class="inapp-divider">Ulasan Pembeli</div>
    ${total===0?`<div class="inapp-empty">📭 Belum ada ulasan. Jadilah yang pertama!</div>`:''}
    ${ulasanData.slice().reverse().map((u,i)=>`
      <div class="ulasan-card">
        <div class="ulasan-card-head">
          <div class="ulasan-av">${escapeHtml(u.nama||'A').charAt(0).toUpperCase()}</div>
          <div class="ulasan-meta">
            <div class="ulasan-nm">${escapeHtml(u.nama||'Anonim')} <span class="ulasan-verified">✓ Verified</span></div>
            <div class="ulasan-time">${escapeHtml(u.waktu||'Baru saja')}</div>
          </div>
          <div class="ulasan-stars">${'★'.repeat(u.stars||5)}</div>
        </div>
        <div class="ulasan-text">${escapeHtml(u.teks||'')}</div>
        <button class="ulasan-like" onclick="likeGlobalUlasan(${ulasanData.length-1-i})">👍 Membantu ${u.likes||0}</button>
      </div>`).join('')}`;
}

function showGlobalUlasanForm(){
  selectedStars=5;
  const body=document.getElementById('ulasan-body');
  body.innerHTML=`
    <button style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;padding:0;margin-bottom:16px;font-family:Sora,sans-serif" onclick="renderGlobalUlasanList()">← Kembali</button>
    <div class="fg"><label class="fl">Nama Kamu</label><input class="fi" id="ul-nama" placeholder="Nama kamu..." maxlength="30"></div>
    <div class="fg">
      <label class="fl">Rating</label>
      <div class="star-picker" id="star-picker">
        <span onclick="setStars(1)">⭐</span><span onclick="setStars(2)">⭐</span><span onclick="setStars(3)">⭐</span><span onclick="setStars(4)">⭐</span><span onclick="setStars(5)">⭐</span>
      </div>
    </div>
    <div class="fg"><label class="fl">Ulasan</label><textarea class="fta" id="ul-teks" placeholder="Ceritakan pengalamanmu..." rows="3" style="min-height:80px"></textarea></div>
    <button class="btn-order" onclick="submitGlobalUlasan()">📨 Kirim Ulasan</button>`;
  updateStarPicker(5);
}

async function submitGlobalUlasan(){
  const nama=(document.getElementById('ul-nama').value||'').trim();
  const teks=(document.getElementById('ul-teks').value||'').trim();
  if(!nama||!teks){showToast('⚠️ Nama dan ulasan wajib diisi!');return;}
  const now=new Date();
  const waktu=`${now.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][now.getMonth()]} ${now.getFullYear()}`;
  ulasanData.push({nama,teks,stars:selectedStars,waktu,likes:0});
  const saved=await dbSet(DB_KEY_ULASAN,ulasanData);
  if(saved){showToast('✅ Ulasan berhasil dikirim dan tersimpan!');}
  else{showToast('✅ Ulasan tersimpan di perangkat ini. Cek Firebase rules agar tersimpan online.');}
  setTimeout(()=>{renderGlobalUlasanList();},400);
}

async function likeGlobalUlasan(idx){
  if(idx<0||idx>=ulasanData.length)return;
  ulasanData[idx].likes=(ulasanData[idx].likes||0)+1;
  await dbSet(DB_KEY_ULASAN,ulasanData);
  renderGlobalUlasanList();
}

function setStars(n){selectedStars=n;updateStarPicker(n);}
function updateStarPicker(n){
  document.querySelectorAll('#star-picker span').forEach((el,i)=>{el.classList.toggle('lit',i<n);});
}

/* =====================================================
   HERO SLIDER
   ===================================================== */
function normalizeMediaUrl(url){
  url=String(url||'').trim();
  if(!url)return '';
  // Ubah link Google Drive share menjadi direct preview agar video tidak menjadi thumbnail/foto diam.
  const drive=url.match(/drive\.google\.com\/file\/d\/([^/]+)/)||url.match(/[?&]id=([^&]+)/);
  if(drive&&drive[1])return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  return url;
}

function forcePlayHeroVideo(video){
  if(!video) return;
  video.muted=true;
  video.defaultMuted=true;
  video.autoplay=true;
  video.loop=true;
  video.playsInline=true;
  video.setAttribute('autoplay','');
  video.setAttribute('muted','');
  video.setAttribute('loop','');
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');
  video.setAttribute('preload','auto');
  video.removeAttribute('poster');
  video.removeAttribute('controls');

  const tryPlay=()=>{
    try{
      video.muted=true;
      const p=video.play();
      if(p&&p.catch)p.catch(()=>{});
    }catch(e){}
  };

  video.addEventListener('loadeddata',tryPlay,{once:true});
  video.addEventListener('canplay',tryPlay,{once:true});
  video.addEventListener('playing',()=>{video.style.opacity='1';});
  video.addEventListener('pause',()=>{if(!video.ended && document.visibilityState==='visible')setTimeout(tryPlay,200);});
  video.addEventListener('stalled',()=>{try{video.load();}catch(e){} setTimeout(tryPlay,350);});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tryPlay();});
  ['touchstart','click'].forEach(evt=>document.addEventListener(evt,tryPlay,{once:true,passive:true}));
  setTimeout(tryPlay,80);
  setTimeout(tryPlay,650);
  setTimeout(tryPlay,1500);
}

function buildHeroSlides(){
  const slidesEl=document.getElementById('hero-slides');
  const dotsEl=document.getElementById('hero-dots');
  slidesEl.innerHTML='';
  dotsEl.innerHTML='';

  const activeVideoUrl=normalizeMediaUrl(adMedia&&(adMedia.videoUrl||adMedia.video||adMedia.urlVideo));
  const activeImageUrl=normalizeMediaUrl(adMedia&&(adMedia.imageUrl||adMedia.image||adMedia.urlImage));
  const videoMode=!!(adMedia&&adMedia.videoOn&&activeVideoUrl);
  const imageMode=!!(adMedia&&adMedia.imageOn&&!videoMode&&activeImageUrl);
  const fixedAdActive=videoMode||imageMode;
  const slides=fixedAdActive?[{
    cleanAd:true,
    prodIdx:0,
    imgUrl:imageMode?activeImageUrl:'',
    videoUrl:videoMode?activeVideoUrl:'',
  }]:(heroSlides&&heroSlides.length?heroSlides:products.map((p,i)=>({
    badge:p.cat==='bot-wa'?'Sewa Bot':p.cat==='panel'?'Panel':p.cat==='source-code'?'Script':p.cat||'Produk',
    title:p.title,
    subtitle:p.desc?p.desc.split('.')[0]:p.title,
    btnLabel:'Lihat →',
    prodIdx:i,
    imgUrl:p.imgUrl||'',
    videoUrl:p.videoUrl||'',
    titleOverlay:p.imgTitle||p.title,
  })));

  const s=slides[0]||{};
  const slide=document.createElement('div');
  slide.className='hero-slide';

  const mediaWrap=document.createElement('div');
  mediaWrap.className='hero-fixed-media';
  mediaWrap.style.cssText='position:absolute;inset:0;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;z-index:0';

  if(s.videoUrl){
    const video=document.createElement('video');
    const src=document.createElement('source');
    src.src=normalizeMediaUrl(s.videoUrl);
    src.type='video/mp4';
    video.appendChild(src);
    video.controls=false;
    video.muted=true;
    video.autoplay=true;
    video.loop=true;
    video.playsInline=true;
    video.disablePictureInPicture=true;
    video.style.cssText='width:100%;height:100%;object-fit:cover;background:#000;display:block;opacity:1';
    mediaWrap.appendChild(video);
    forcePlayHeroVideo(video);
  }else if(s.imgUrl){
    const img=document.createElement('img');
    img.src=normalizeMediaUrl(s.imgUrl);
    img.loading='eager';
    img.decoding='async';
    img.style.cssText='width:100%;height:100%;object-fit:cover;background:#000;display:block';
    mediaWrap.appendChild(img);
  }else{
    const bg=document.createElement('div');
    bg.className='hero-anime-bg';
    mediaWrap.appendChild(bg);
  }

  slide.appendChild(mediaWrap);

  if(!s.cleanAd){
    const overlay=document.createElement('div');
    overlay.style.cssText='position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.78),rgba(0,0,0,.15));z-index:1';
    slide.appendChild(overlay);

    const content=document.createElement('div');
    content.className='hero-content';
    content.style.zIndex='2';
    content.innerHTML=`<div class="hero-badge">${s.badge||'Iklan'}</div><h1>${s.title||'Yonz Official'}</h1><p>${s.subtitle||'Premium Store'}</p><button class="btn-hero" onclick="openModal(${s.prodIdx!=null?s.prodIdx:0})">${s.btnLabel||'Lihat →'}</button>`;
    slide.appendChild(content);
  }
  slidesEl.appendChild(slide);

  if(sliderInterval) clearInterval(sliderInterval);
}
function goToSlide(idx){const s=document.getElementById('hero-slides');const dots=document.querySelectorAll('.hero-dot');currentSlide=idx;s.style.transform=`translateX(-${idx*100}%)`;dots.forEach((d,i)=>d.classList.toggle('active',i===idx));}
function nextSlide(){const n=document.querySelectorAll('.hero-dot').length;goToSlide((currentSlide+1)%n);}
function prevSlide(){const n=document.querySelectorAll('.hero-dot').length;goToSlide((currentSlide-1+n)%n);}
function startSlider(count){if(sliderInterval)clearInterval(sliderInterval);if(count>1)sliderInterval=setInterval(nextSlide,3500);}

/* =====================================================
   PRODUCT GRID
   ===================================================== */
function renderProductGrid(){
  const grid=document.getElementById('products-grid');grid.innerHTML='';
  const catMap={'bot-wa':'bot','panel':'panel','source-code':'sc'};
  products.forEach((p,i)=>{
    const featured=(i===products.length-1&&products.length%2!==0)||p.featured;
    const card=document.createElement('div');
    card.className='product-card'+(featured?' featured':'');
    card.dataset.cat=p.cat||'semua';
    card.dataset.prodid=p.id;
    card.onclick=()=>openModal(i);
    let cardImgStyle='';
    if(p.imgUrl){cardImgStyle=`background-image:linear-gradient(to top,rgba(4,1,12,.92) 0%,rgba(4,1,12,.4) 58%,rgba(4,1,12,.05) 100%),url('${p.imgUrl}');background-size:cover;background-position:center;`;}
    const imgClass=catMap[p.cat]||'bot';
    const reviews=getProductReviews(p.id);
    const{avg,total}=getReviewStats(reviews);
    card.innerHTML=`
      <div class="card-img ${p.imgUrl?'':imgClass}" style="${cardImgStyle}">
        ${!p.imgUrl?`<div class="orb" style="width:${featured?'65':'52'}px;height:${featured?'65':'52'}px;top:9%;right:11%;background:radial-gradient(circle,rgba(160,60,255,.52),transparent 70%)"></div>
        <div class="orb" style="width:32px;height:32px;bottom:22%;left:14%;background:radial-gradient(circle,rgba(200,60,240,.38),transparent 70%);animation-delay:2s"></div>`:''}
        <div class="card-img-label">
          <div class="card-title-img">${(p.imgTitle||p.title).replace(/<[^>]+>/g,'')}</div>
          <div class="card-sub-img">${escapeHtml(getProductLabel())}</div>
        </div>
      </div>
      <span class="badge-new">Baru</span>
      <span class="badge-type">${p.cat==='bot-wa'?'Sewa Bot':p.cat==='panel'?'Panel':p.cat==='source-code'?'Download':p.cat||'Produk'}</span>
      <div class="card-body">
        <div class="card-name">${p.title}</div>
        <div class="card-category">${p.cat==='bot-wa'?'Bot WA':p.cat==='panel'?'Panel':p.cat==='source-code'?'Script':p.cat||'Lainnya'}</div>
        <div class="stars"><span class="star-icons">★★★★★</span><span class="star-count"> ${avg.toFixed(1)}</span><span class="star-review"> (${total})</span></div>
        <div class="card-price">${p.price||'Rp0'}</div>
        <div class="stock-info"><span class="stock-dot"></span>Stok Unlimited</div>
      </div>`;
    // Ulasan sengaja tidak ditampilkan di menu utama.
    // Ulasan hanya muncul saat produk diklik melalui modal detail produk.
    grid.appendChild(card);
  });
  document.getElementById('prod-count').textContent=`${products.length} Produk`;
  // Premium additions after render
  setTimeout(()=>{
    injectCardShine&&injectCardShine();
    initCardTilt&&initCardTilt();
    addViewCounts&&addViewCounts();
    addFlashBadges&&addFlashBadges();
    initScrollReveal&&initScrollReveal();
  },60);
}

/* =====================================================
   PRODUCT MODAL
   ===================================================== */
function openModal(idx){
  activeIdx=idx;activeVar=0;
  const p=products[idx];
  const catMap={'bot-wa':'bot','panel':'panel','source-code':'sc'};
  const imgEl=document.getElementById('m-modal-img');
  imgEl.className='modal-img '+(catMap[p.cat]||'bot');
  if(p.imgUrl){imgEl.style.backgroundImage=`linear-gradient(to top,rgba(4,1,12,.96) 0%,rgba(4,1,12,.42) 58%,rgba(4,1,12,.08) 100%),url('${p.imgUrl}')`;imgEl.style.backgroundSize='cover';imgEl.style.backgroundPosition='center';}
  else{imgEl.style.backgroundImage='';imgEl.style.backgroundSize='';}
  document.getElementById('m-img-title').textContent=p.imgTitle||p.title;
  const subEl=document.getElementById('m-img-sub');if(subEl)subEl.textContent=getProductLabel();
  document.getElementById('m-title').textContent=p.title;
  document.getElementById('m-price').textContent=p.price;
  document.getElementById('m-avail').textContent=p.available;
  document.getElementById('m-desc').textContent=p.desc;
  const vg=document.getElementById('m-varians');vg.innerHTML='';
  p.varians.forEach((v,i)=>{
    const b=document.createElement('button');b.className='vbtn'+(i===0?' active':'');
    b.innerHTML=`<div class="vbtn-name">${v.name}</div><div class="vbtn-price">${v.price}</div>`;
    b.onclick=()=>{document.querySelectorAll('.vbtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeVar=i;document.getElementById('m-price').textContent=v.price;};
    vg.appendChild(b);
  });
  const fg=document.getElementById('m-features');fg.innerHTML='';
  p.features.forEach(f=>{fg.innerHTML+=`<div class="fcard"><div class="fcard-icon">${f.icon}</div><div class="fcard-name">${f.name}</div><div class="fcard-desc">${f.desc}</div></div>`;});
  renderProductReviewsSection(idx);
  document.getElementById('prod-overlay').classList.add('open');
}
function closeProdBg(e){if(e.target===document.getElementById('prod-overlay'))closeProd();}
function closeProd(){document.getElementById('prod-overlay').classList.remove('open');}

/* =====================================================
   ORDER FORM
   ===================================================== */
function normalizeProductOrderForm(p){
  const old=p&&p.orderForm&&typeof p.orderForm==='object'?p.orderForm:null;
  const fields=Array.isArray(old?.fields)?old.fields.filter(f=>f&&f.label):[];
  if(old)return{disabled:old.disabled===true,fields};
  if(p&&(p.id==='panel'||p.cat==='panel'))return{disabled:false,fields:[{label:'Nama Panel',placeholder:'Contoh: BotKu Panel',required:true,type:'text'},{label:'Password Panel',placeholder:'Buat password yang kuat',required:true,type:'text'}]};
  return{disabled:true,fields:[]};
}
function renderDynamicProductForm(p){
  const box=document.getElementById('f-product-dynamic');
  if(!box)return;
  const form=normalizeProductOrderForm(p);
  box.innerHTML='';
  box.style.display='none';
  if(form.disabled||!form.fields.length)return;
  box.style.display='block';
  box.innerHTML='<div class="fsec">Data Pesanan</div>'+form.fields.map((f,i)=>`<div class="fg"><label class="fl">${escapeHtml(f.label)}${f.required!==false?' <span style="color:var(--red)">*</span>':''}</label><input class="fi product-form-input" data-label="${escapeHtml(f.label)}" data-required="${f.required!==false?'1':'0'}" placeholder="${escapeHtml(f.placeholder||f.label)}" type="text"></div>`).join('');
}
function collectDynamicProductForm(){
  const inputs=[...document.querySelectorAll('.product-form-input')];
  const rows=[];
  for(const inp of inputs){
    const label=inp.dataset.label||'Data';
    const val=(inp.value||'').trim();
    if(inp.dataset.required==='1'&&!val){showToast('⚠️ Lengkapi '+label+'!');return null;}
    if(val)rows.push({label,value:val});
  }
  return rows;
}

function normalizeVoucherPublic(v){
  const type=(v?.discountType==='percent'||v?.discountType==='nominal')?v.discountType:'nominal';
  const raw=Number(v?.discountValue ?? v?.discount ?? 0);
  return {code:String(v?.code||'').trim().toUpperCase(),title:String(v?.title||'Diskon Produk').trim(),desc:String(v?.desc||'').trim(),limit:Math.max(1,Number(v?.limit)||1),used:Math.max(0,Number(v?.used)||0),discountType:type,discountValue:Math.max(0,raw||0),active:v?.active!==false};
}
function parsePriceNumber(price){
  const n=Number(String(price||'').replace(/[^0-9]/g,''));
  return Number.isFinite(n)?n:0;
}
function formatRupiah(n){
  n=Math.max(0,Math.round(Number(n)||0));
  return 'Rp'+n.toLocaleString('id-ID');
}
function getDiscountAmount(priceText,voucher){
  const base=parsePriceNumber(priceText);if(!base||!voucher)return 0;
  let d=voucher.discountType==='percent'?base*(Number(voucher.discountValue)||0)/100:Number(voucher.discountValue)||0;
  d=Math.max(0,Math.round(d));
  return Math.min(base,d);
}
function getFinalPriceText(priceText,voucher){
  const base=parsePriceNumber(priceText);const discount=getDiscountAmount(priceText,voucher);
  if(!base||!discount)return {baseText:priceText,discountText:'Rp0',finalText:priceText,discount};
  return {baseText:formatRupiah(base),discountText:formatRupiah(discount),finalText:formatRupiah(base-discount),discount};
}
function describeVoucherDiscount(v){
  if(!v||!v.discountValue)return 'Diskon belum diatur';
  return v.discountType==='percent'?`Diskon ${v.discountValue}%`:`Diskon ${formatRupiah(v.discountValue)}`;
}
function getActiveProductVouchers(p){
  return (Array.isArray(p?.vouchers)?p.vouchers:[]).map(normalizeVoucherPublic).filter(v=>v.active!==false&&v.code&&v.used<v.limit);
}
function renderProductVouchers(p){
  selectedVoucher=null;
  const box=document.getElementById('f-voucher-box');if(!box)return;
  const list=getActiveProductVouchers(p);
  box.style.display=list.length?'block':'none';
  if(!list.length){box.innerHTML='';return;}
  box.innerHTML=`<div class="fsec">Kode Voucher / Promo</div>
  <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:12px">
    <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:8px">Voucher ini hanya berlaku untuk produk ini. Tetap bisa dipakai walau form produk dimatikan.</div>
    <div style="display:flex;gap:6px;margin-bottom:8px"><input class="fi" id="voucher-input" placeholder="Masukkan kode voucher" style="margin:0;text-transform:uppercase"><button class="btn-order" style="width:auto;margin:0;padding:9px 12px;font-size:11px" onclick="applyProductVoucher()">Pakai</button></div>
    <div id="voucher-result" style="font-size:11px;color:var(--muted);line-height:1.5"></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${list.map(v=>`<button type="button" onclick="quickUseVoucher('${escapeHtml(v.code)}')" style="border:1px solid var(--border);background:rgba(124,58,237,.08);color:var(--purple-light);border-radius:999px;padding:5px 9px;font-size:10px;cursor:pointer">${escapeHtml(v.code)} · ${escapeHtml(describeVoucherDiscount(v))} · sisa ${Math.max(0,v.limit-v.used)}</button>`).join('')}</div>
  </div>`;
}
function quickUseVoucher(code){const inp=document.getElementById('voucher-input');if(inp)inp.value=code;applyProductVoucher();}
function applyProductVoucher(){
  if(activeIdx===null)return;
  const p=products[activeIdx];const input=document.getElementById('voucher-input');const res=document.getElementById('voucher-result');const code=String(input?.value||'').trim().toUpperCase();
  const list=getActiveProductVouchers(p);
  const found=list.find(v=>v.code===code);
  if(!code){selectedVoucher=null;if(res)res.innerHTML='<span style="color:var(--red)">Masukkan kode voucher dulu.</span>';return;}
  if(!found){selectedVoucher=null;if(res)res.innerHTML='<span style="color:var(--red)">Kode tidak berlaku untuk produk ini atau kuota sudah habis.</span>';return;}
  selectedVoucher=found;
  const v=products[activeIdx]?.varians?.[activeVar]||{};
  const priceInfo=getFinalPriceText(v.price,found);
  if(res)res.innerHTML=`<span style="color:var(--green)">✅ Voucher dipakai: <b>${escapeHtml(found.code)}</b></span><br>${escapeHtml(found.title)} · ${escapeHtml(describeVoucherDiscount(found))}${found.desc?' — '+escapeHtml(found.desc):''}<br>Harga awal: <s>${escapeHtml(priceInfo.baseText)}</s><br>Potongan: ${escapeHtml(priceInfo.discountText)}<br><b>Harga setelah diskon: ${escapeHtml(priceInfo.finalText)}</b><br>Sisa kuota setelah dipakai: ${Math.max(0,found.limit-found.used-1)}`;
}
async function markVoucherUsed(productId,code){
  if(!productId||!code)return;
  try{
    const data=typeof dbGet==='function'?await dbGet('store-produk'):products;
    const arr=Array.isArray(data)?data:(data&&typeof data==='object'?Object.values(data):products);
    const pi=arr.findIndex(x=>x&&x.id===productId);
    if(pi<0)return;
    const vs=Array.isArray(arr[pi].vouchers)?arr[pi].vouchers:[];
    const vi=vs.findIndex(v=>String(v?.code||'').toUpperCase()===String(code).toUpperCase());
    if(vi<0)return;
    const v=normalizeVoucherPublic(vs[vi]);
    if(v.used>=v.limit)return;
    vs[vi]={...vs[vi],used:v.used+1};arr[pi].vouchers=vs;
    if(typeof dbSet==='function')await dbSet('store-produk',arr);
    products=arr;
  }catch(e){console.warn('markVoucherUsed gagal:',e);}
}

function openOrderForm(){
  if(activeIdx===null)return;
  const p=products[activeIdx];const v=p.varians[activeVar];
  document.getElementById('of-sub').textContent=p.title+' — '+v.name;
  document.getElementById('of-name').textContent=p.title;
  document.getElementById('of-var').textContent=v.name;
  document.getElementById('of-price').textContent=v.price;
  ['f-panel','f-noform','f-product-dynamic','f-voucher-box'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const form=normalizeProductOrderForm(p);
  const noForm=document.getElementById('f-noform');
  if(form.disabled||!form.fields.length){if(noForm)noForm.style.display='block';}
  else renderDynamicProductForm(p);
  renderProductVouchers(p);
  // FIX: Reset checkout progress steps ke awal setiap buka form baru
  const cs2=document.getElementById('cstep-2');
  const cs3=document.getElementById('cstep-3');
  const cl2=document.getElementById('csline-2');
  if(cs2){cs2.classList.remove('done');cs2.classList.add('active');const circ=cs2.querySelector('.cs-step-circle');if(circ)circ.textContent='2';}
  if(cs3){cs3.classList.remove('active','done');}
  if(cl2)cl2.classList.remove('done');
  closeProd();document.getElementById('order-overlay').classList.add('open');
}
function closeOrderBg(e){if(e.target===document.getElementById('order-overlay'))closeOrder();}
function closeOrder(){document.getElementById('order-overlay').classList.remove('open');}

function goToPayment(){
  if(activeIdx===null)return;
  const p=products[activeIdx];const v=p.varians[activeVar];let msg='';
  const isScript=false; // auto-download SC dinonaktifkan
  const form=normalizeProductOrderForm(p);
  let extraRows=[];
  if(!form.disabled&&form.fields.length){
    extraRows=collectDynamicProductForm();
    if(extraRows===null)return;
  }
  const extraText=extraRows.length?`

📋 *DATA PESANAN:*
${extraRows.map(r=>`${r.label} : ${r.value}`).join('\n')}`:'';
  let voucherText='';
  let checkoutPriceText=v.price;
  if(selectedVoucher){
    const stillValid=getActiveProductVouchers(p).find(v=>v.code===selectedVoucher.code);
    if(!stillValid){showToast('⚠️ Kuota voucher sudah habis / tidak aktif.');selectedVoucher=null;return;}
    selectedVoucher=stillValid;
    const priceInfo=getFinalPriceText(v.price,selectedVoucher);
    checkoutPriceText=priceInfo.finalText;
    voucherText=`\n🎟️ Voucher : ${selectedVoucher.code} - ${selectedVoucher.title}\n🏷️ Diskon  : ${describeVoucherDiscount(selectedVoucher)}\n💸 Potongan: ${priceInfo.discountText}\n✅ Total   : ${priceInfo.finalText}${selectedVoucher.desc?'\n📝 Promo   : '+selectedVoucher.desc:''}`;
  }
  msg=`🛒 *ORDER ${String(p.title||'PRODUK').toUpperCase()}*
━━━━━━━━━━━━━━━━━━
📦 Produk  : ${p.title}
⏱️ Varian  : ${v.name}
💰 Harga   : ${v.price}${voucherText}${extraText}
━━━━━━━━━━━━━━━━━━
🛒 _Order via ${STORE_NAME}_`;

  pendingOrderMsg=msg;
  pendingIsScript=isScript;
  if(selectedVoucher)markVoucherUsed(p.id,selectedVoucher.code);
  // Update checkout progress to step 3
  const cs2=document.getElementById('cstep-2');const cs3=document.getElementById('cstep-3');const cl2=document.getElementById('csline-2');
  if(cs2){cs2.classList.remove('active');cs2.classList.add('done');cs2.querySelector('.cs-step-circle').textContent='✓';}
  if(cl2)cl2.classList.add('done');
  if(cs3){cs3.classList.add('active');}
  closeOrder();setTimeout(()=>openPayOverlay(p.title,v.name,checkoutPriceText),250);
}

/* =====================================================
   PAYMENT
   ===================================================== */
function openPayOverlay(prodTitle,varName,price){
  selectedPayMethod=null;
  document.getElementById('pay-sum-text').textContent=`${prodTitle} — ${varName}`;
  document.getElementById('pay-sum-price').textContent=price;
  const confirmBtn=document.getElementById('btn-pay-confirm');
  confirmBtn.innerHTML='📲 Sudah Bayar — Kirim ke Admin WA';
  confirmBtn.style.background='linear-gradient(135deg,#7c3aed,#d946ef)';
  const list=document.getElementById('pay-methods-list');list.innerHTML='';
  const methods=[];const pc=PAYMENT_CFG;
  if(pc.dana?.active!==false)methods.push({id:'dana',icon:'💙',bg:'linear-gradient(135deg,#118EEA,#0066CC)',name:'DANA',no:pc.dana?.no||'628132988940',ownerName:pc.dana?.name||''});
  if(pc.gopay?.active!==false)methods.push({id:'gopay',icon:'💚',bg:'linear-gradient(135deg,#00AED6,#00875A)',name:'GoPay',no:pc.gopay?.no||'628132988940',ownerName:pc.gopay?.name||''});
  if(pc.ovo?.active!==false)methods.push({id:'ovo',icon:'💜',bg:'linear-gradient(135deg,#4B2D8E,#7B4FCC)',name:'OVO',no:pc.ovo?.no||'628132988940',ownerName:pc.ovo?.name||''});
  if(pc.qris?.active!==false)methods.push({id:'qris',icon:'⬛',bg:'linear-gradient(135deg,#E44034,#C0392B)',name:'QRIS (Semua Bank)',no:'Scan QR Code',isQris:true,qrisUrl:pc.qris?.url||'',ownerName:pc.qris?.name||''});
  if(pc.bank?.active===true)methods.push({id:'bank',icon:'🏦',bg:'linear-gradient(135deg,#F39C12,#D35400)',name:pc.bank?.bankName||'Transfer Bank',no:pc.bank?.no||'',ownerName:pc.bank?.name||''});
  if(!methods.length){list.innerHTML='<div style="text-align:center;padding:16px;color:#8892a4;font-size:12px">Tidak ada metode pembayaran aktif.<br>Hubungi admin.</div>';}
  else{
    methods.forEach(m=>{
      const btn=document.createElement('div');btn.className='pay-method-btn';btn.dataset.id=m.id;
      btn.innerHTML=`<div class="pay-method-icon" style="background:${m.bg}">${m.icon}</div><div class="pay-method-info"><div class="pay-method-name">${m.name}</div><div class="pay-method-no">${m.isQris?'Scan QR Code':m.no}${m.ownerName?' · '+m.ownerName:''}</div></div><div class="pay-radio"></div>`;
      btn.onclick=()=>selectPayMethod(m,btn);list.appendChild(btn);
    });
    if(methods.length)selectPayMethod(methods[0],list.children[0]);
  }
  const afterEl=document.getElementById('pay-after-msg-el');
  if(pc.afterMsg){afterEl.textContent='✅ '+pc.afterMsg;afterEl.classList.add('show');}
  else afterEl.classList.remove('show');
  // Reset proof state
  resetProofState();
  document.getElementById('pay-overlay').classList.add('open');
}

function selectPayMethod(method,btnEl){
  selectedPayMethod=method;
  document.querySelectorAll('.pay-method-btn').forEach(b=>b.classList.remove('selected'));
  btnEl.classList.add('selected');renderPayInstruct(method);
}
function renderPayInstruct(m){
  const box=document.getElementById('pay-instruct');let html=`<div class="pay-instruct-title">📋 Cara Bayar via ${m.name}</div>`;
  if(m.isQris){
    html+=`<div class="pay-step"><div class="pay-step-num">1</div><div class="pay-step-text">Screenshot atau download QR Code di bawah ini</div></div>
    <div class="qris-wrap">
      <img class="qris-img" id="qris-img-el" src="${m.qrisUrl}" alt="QRIS" onerror="this.style.background='#333'" onclick="openQrisFullscreen('${m.qrisUrl}')">
      <div class="qris-label">QRIS · ${m.ownerName||STORE_NAME}</div>
      <div class="qris-hint">💡 Ketuk gambar untuk perbesar · Atau download untuk scan</div>
      <button class="qris-download-btn" onclick="downloadQris('${m.qrisUrl}')">⬇️ Download QRIS untuk Scan</button>
    </div>
    <div class="pay-step" style="margin-top:12px"><div class="pay-step-num">2</div><div class="pay-step-text">Buka aplikasi e-wallet/m-banking, pilih <strong>Bayar via QRIS</strong></div></div>
    <div class="pay-step"><div class="pay-step-num">3</div><div class="pay-step-text">Scan QR Code, masukkan nominal sesuai harga produk</div></div>
    <div class="pay-step"><div class="pay-step-num">4</div><div class="pay-step-text">Klik <strong>"Sudah Bayar"</strong> lalu kirim bukti ke admin WA</div></div>`;
  }else{
    html+=`<div class="pay-step"><div class="pay-step-num">1</div><div class="pay-step-text">Buka aplikasi <strong>${m.name}</strong> di HP kamu</div></div>
    <div class="pay-step"><div class="pay-step-num">2</div><div class="pay-step-text">Transfer ke nomor: <div class="pay-copy-box"><span class="pay-copy-val" id="copy-no-${m.id}">${m.no}</span><button class="pay-copy-btn" onclick="copyPayNo('${m.no}','copy-no-${m.id}')">Salin</button></div>${m.ownerName?`<div style="font-size:11px;color:#8892a4;margin-top:4px">a/n <strong style="color:#e2e8f0">${m.ownerName}</strong></div>`:''}</div></div>
    <div class="pay-step"><div class="pay-step-num">3</div><div class="pay-step-text">Masukkan nominal sesuai harga produk</div></div>
    <div class="pay-step"><div class="pay-step-num">4</div><div class="pay-step-text">Klik <strong>"Sudah Bayar"</strong> lalu kirim bukti ke admin WA</div></div>`;
  }
  box.innerHTML=html;box.classList.add('show');
}
function copyPayNo(text,elId){
  navigator.clipboard.writeText(text).catch(()=>{});
  const el=document.getElementById(elId);
  const btn=el?.nextElementSibling;
  if(btn){btn.textContent='✅ Disalin';setTimeout(()=>{btn.textContent='Salin';},2000);}
}

function resetProofState(){
  proofImgFile=null;proofImgUrl='';
  const input=document.getElementById('pay-proof-input');
  if(input)input.value='';
  const img=document.getElementById('pay-proof-img');
  if(img)img.src='';
  const dzContent=document.getElementById('pay-proof-dz-content');
  if(dzContent)dzContent.style.display='flex';
  const preview=document.getElementById('pay-proof-preview');
  if(preview)preview.style.display='none';
  const dropzone=document.getElementById('pay-proof-dropzone');
  if(dropzone)dropzone.classList.remove('has-img');
  hideProofStatus();
}

function closePayOverlay(){
  document.getElementById('pay-overlay').classList.remove('open');
  resetProofState();
}

function downloadQris(url){
  if(!url){showToast('⚠️ URL QRIS tidak ditemukan!');return;}
  fetch(url).then(r=>r.blob()).then(blob=>{
    const blobUrl=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=blobUrl;a.download='QRIS-UnoTech.jpg';
    document.body.appendChild(a);a.click();
    document.body.removeChild(a);URL.revokeObjectURL(blobUrl);
    showToast('✅ QRIS berhasil didownload!');
  }).catch(()=>{window.open(url,'_blank');showToast('💡 QRIS dibuka di tab baru, tekan & tahan untuk simpan.');});
}

function openQrisFullscreen(url){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;';
  ov.innerHTML=`<img src="${url}" style="width:min(90vw,380px);height:min(90vw,380px);border-radius:16px;object-fit:contain;background:#fff;padding:10px;box-shadow:0 0 40px rgba(124,58,237,.4)">
    <div style="font-size:12px;color:#8892a4">Ketuk di luar untuk tutup</div>
    <button onclick="downloadQris('${url}')" style="padding:10px 24px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#d946ef);color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:Sora,sans-serif">⬇️ Download QRIS</button>`;
  ov.onclick=e=>{if(e.target===ov)document.body.removeChild(ov);};
  document.body.appendChild(ov);
}

/* =====================================================
   DRAG & DROP BUKTI PEMBAYARAN
   ===================================================== */
function initProofDropzone(){
  const dz=document.getElementById('pay-proof-dropzone');
  if(!dz)return;
  dz.addEventListener('dragover',e=>{
    e.preventDefault();e.stopPropagation();
    dz.classList.add('dragover');
  });
  dz.addEventListener('dragleave',e=>{
    e.preventDefault();e.stopPropagation();
    dz.classList.remove('dragover');
  });
  dz.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();
    dz.classList.remove('dragover');
    const files=e.dataTransfer?.files;
    if(files&&files.length>0){
      const file=files[0];
      if(!file.type.startsWith('image/')){showProofErr('⚠️ Hanya file gambar yang diizinkan!');return;}
      if(file.size>10*1024*1024){showProofErr('⚠️ Ukuran file maksimal 10MB!');return;}
      proofImgFile=file;proofImgUrl='';
      const reader=new FileReader();
      reader.onload=ev=>{
        document.getElementById('pay-proof-img').src=ev.target.result;
        document.getElementById('pay-proof-dz-content').style.display='none';
        document.getElementById('pay-proof-preview').style.display='block';
        dz.classList.add('has-img');
        hideProofStatus();
      };
      reader.readAsDataURL(file);
    }
  });
}

/* =====================================================
   IMGBB UPLOAD BUKTI PEMBAYARAN
   ===================================================== */
const IMGBB_API_KEY='2ed7029897fa0236790644e347dc765d';
let proofImgFile=null;
let proofImgUrl='';

function handleProofFileSelect(e){
  const file=e.target.files[0];
  if(!file)return;
  if(!file.type.startsWith('image/')){showProofErr('⚠️ Hanya file gambar yang diizinkan!');return;}
  if(file.size>10*1024*1024){showProofErr('⚠️ Ukuran file maksimal 10MB!');return;}
  proofImgFile=file;proofImgUrl='';
  const reader=new FileReader();
  reader.onload=ev=>{
    document.getElementById('pay-proof-img').src=ev.target.result;
    document.getElementById('pay-proof-dz-content').style.display='none';
    document.getElementById('pay-proof-preview').style.display='block';
    document.getElementById('pay-proof-dropzone').classList.add('has-img');
    hideProofStatus();
  };
  reader.readAsDataURL(file);
}

function removeProofImg(){
  resetProofState();
}

function hideProofStatus(){
  document.getElementById('pay-proof-uploading').style.display='none';
  document.getElementById('pay-proof-success').style.display='none';
  document.getElementById('pay-proof-err').style.display='none';
}

function showProofErr(msg){
  hideProofStatus();
  const el=document.getElementById('pay-proof-err');
  el.textContent=msg;el.style.display='block';
}

async function uploadProofToImgbb(file){
  const formData=new FormData();
  formData.append('image',file);
  const res=await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,{method:'POST',body:formData});
  const data=await res.json();
  if(!data.success)throw new Error(data?.error?.message||'Upload gagal');
  return data.data.url;
}

async function confirmPayAndSendWA(){
  if(!pendingOrderMsg){showToast('⚠️ Data order tidak ditemukan!');return;}
  if(!proofImgFile&&!proofImgUrl){
    showProofErr('⚠️ Wajib upload foto bukti pembayaran terlebih dahulu!');
    document.getElementById('pay-proof-section').scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  const btn=document.getElementById('btn-pay-confirm');
  btn.disabled=true;
  btn.innerHTML='⏳ Memproses...';

  if(proofImgFile&&!proofImgUrl){
    hideProofStatus();
    document.getElementById('pay-proof-uploading').style.display='flex';
    try{
      proofImgUrl=await uploadProofToImgbb(proofImgFile);
      document.getElementById('pay-proof-uploading').style.display='none';
      document.getElementById('pay-proof-success').style.display='block';
    }catch(err){
      showProofErr('❌ Gagal upload foto: '+err.message+'. Coba lagi!');
      btn.disabled=false;
      btn.innerHTML='📲 Sudah Bayar — Kirim ke Admin WA';
      return;
    }
  }

  const m=selectedPayMethod;let payInfo='';
  if(m){if(m.isQris)payInfo=`\n\n💳 *METODE BAYAR:* QRIS`;else payInfo=`\n\n💳 *METODE BAYAR:* ${m.name}\n📱 Nomor : ${m.no}${m.ownerName?'\na/n    : '+m.ownerName:''}`;}
  const fullMsg=pendingOrderMsg+payInfo+`\n\n📸 *BUKTI PEMBAYARAN:*\n${proofImgUrl}`;
  window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(fullMsg)}`,'_blank');

  btn.disabled=false;
  btn.innerHTML='📲 Sudah Bayar — Kirim ke Admin WA';
  closePayOverlay();

  // 🎉 KONFETTI on successful order!
  setTimeout(()=>launchKonfetti(),300);

}

/* =====================================================
   DRAWER
   ===================================================== */
function renderDrawer(items){
  const ul=document.getElementById('drawer-menu-list');if(!ul)return;
  const defaults=[
    {label:'🏠 Home',url:'#top'},
    {label:'🤖 Perpanjang Sewa Bot',url:'#renew-bot'},
    {label:'🔄 Perpanjang Panel',url:'#renew'},
    {label:'🔍 Track Order',url:'#track'},
    {label:'⭐ Ulasan',url:'#ulasan'},
    {label:'💬 Live Chat',url:'#chat'}
  ];
  const list=items&&items.length?items:defaults;
  ul.innerHTML='';
  list.forEach(it=>{
    const li=document.createElement('li');const a=document.createElement('a');a.href='#';
    const url=(it.url||'#').trim();
    if(url==='#top'||url==='#'){
      a.onclick=e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});closeDrawer();};
    }else if(url==='#chat'){
      a.onclick=e=>{e.preventDefault();closeDrawer();setTimeout(()=>toggleChat(),220);};
    }else if(url==='#renew'){
      a.onclick=e=>{e.preventDefault();closeDrawer();setTimeout(()=>openRenewModal(),200);};
    }else if(url==='#renew-bot'){
      // FIX: handler untuk perpanjang sewa bot yang sebelumnya missing
      a.onclick=e=>{e.preventDefault();closeDrawer();setTimeout(()=>openRenewBotModal(),200);};
    }else if(url==='#track'){
      a.onclick=e=>{e.preventDefault();closeDrawer();setTimeout(()=>openTrackModal(),200);};
    }else if(url==='#ulasan'){
      a.onclick=e=>{e.preventDefault();closeDrawer();setTimeout(()=>openUlasanModal(),200);};
    }else if(url.startsWith('wa:')){
      const msg=url.slice(3);
      a.onclick=e=>{e.preventDefault();window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`,'_blank');closeDrawer();};
    }else if(url.startsWith('http')){
      a.href=url;a.target='_blank';a.onclick=()=>closeDrawer();
    }else{
      a.onclick=e=>e.preventDefault();
    }
    const parts=it.label.match(/^(\S+)\s(.+)$/);
    if(parts){a.innerHTML=`<span class="mi">${parts[1]}</span>${parts[2]}`;}else{a.textContent=it.label;}
    li.appendChild(a);ul.appendChild(li);
  });
}
function openDrawer(){document.getElementById('drawer').classList.add('open');document.getElementById('drawer-overlay').classList.add('open');}
function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('drawer-overlay').classList.remove('open');}
function openChannelWa(){contactAdmin();}
function openCsWhatsApp(){window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(WA_DEFAULT_MESSAGE)}`,'_blank');}
function openCsTelegram(){const u=String(TELEGRAM_USER||'').replace(/^@/,'').trim();if(!u){showToast('Username Telegram belum diatur admin.');return;}window.open(`https://t.me/${u}`,'_blank');}
function getActiveCsChannels(){const arr=[];if(CS_CHANNELS.whatsapp!==false&&ADMIN_WA)arr.push('wa');if(CS_CHANNELS.telegram===true&&TELEGRAM_USER)arr.push('tg');return arr;}
function contactAdmin(){
  const active=getActiveCsChannels();
  if(active.length===0){showToast('Kontak CS sedang dimatikan admin.');return;}
  if(active.length===1){active[0]==='tg'?openCsTelegram():openCsWhatsApp();return;}
  let modal=document.getElementById('cs-choice-modal');
  if(!modal){
    modal=document.createElement('div');modal.id='cs-choice-modal';
    modal.style.cssText='position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:18px';
    modal.innerHTML=`<div style="width:min(360px,94vw);border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,#121225,#090914);border-radius:22px;padding:18px;box-shadow:0 22px 70px rgba(0,0,0,.55);color:#fff;font-family:'Noto Sans',sans-serif">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><div><div style="font-family:'Syne',sans-serif;font-weight:800;font-size:18px">Hubungi CS</div><div style="font-size:12px;color:#94a3b8;margin-top:3px">Pilih mau lewat WhatsApp atau Telegram</div></div><button onclick="closeCsChoice()" style="border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:12px;width:34px;height:34px;font-size:18px">×</button></div>
      <button onclick="openCsWhatsApp();closeCsChoice()" style="width:100%;border:0;border-radius:16px;padding:13px;margin:6px 0;background:linear-gradient(135deg,#25D366,#128C7E);color:white;font-weight:800;font-size:14px;cursor:pointer">🟢 Chat via WhatsApp</button>
      <button onclick="openCsTelegram();closeCsChoice()" style="width:100%;border:0;border-radius:16px;padding:13px;margin:6px 0;background:linear-gradient(135deg,#229ED9,#1377b8);color:white;font-weight:800;font-size:14px;cursor:pointer">🔵 Chat via Telegram</button>
    </div>`;
    modal.onclick=e=>{if(e.target===modal)closeCsChoice();};document.body.appendChild(modal);
  }
  modal.style.display='flex';
}
function closeCsChoice(){const m=document.getElementById('cs-choice-modal');if(m)m.style.display='none';}
function contactOwnerMaintenance(){contactAdmin();}

/* =====================================================
   FILTER TABS
   ===================================================== */
function filterTab(el,cat){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  let n=0;document.querySelectorAll('.product-card').forEach(c=>{const s=cat==='semua'||c.dataset.cat===cat;c.style.display=s?'':'none';if(s)n++;});
  document.getElementById('prod-count').textContent=`${n} Produk`;
}

/* =====================================================
   PERPANJANG PANEL
   ===================================================== */
function openRenewModal(){renderRenewForm();document.getElementById('renew-overlay').classList.add('open');}
function closeRenewModal(){document.getElementById('renew-overlay').classList.remove('open');}
function getPanelProductForRenew(){
  const list=Array.isArray(products)?products:[];
  return list.find(p=>p&&(p.id==='panel'||p.cat==='panel'||/panel/i.test(p.title||'')))||DEFAULT_PRODUCTS.find(p=>p.id==='panel');
}
function buildPanelRenewOptions(){
  const panel=getPanelProductForRenew()||{};
  const vars=Array.isArray(panel.varians)?panel.varians.filter(v=>v&&(v.name||v.price)):[];
  const source=vars.length?vars:[{name:panel.title||'Panel Bot WA',price:panel.price||'Rp0'}];
  return source.map(v=>{
    const name=(v.name||'Panel').trim();
    const price=(v.price||panel.price||'Rp0').trim();
    const label=`${name} — ${price}`;
    return `<option value="${escapeHtml(label)}">📦 ${escapeHtml(label)}</option>`;
  }).join('');
}
function renderRenewForm(){
  const panel=getPanelProductForRenew()||{};
  const panelTitle=panel.title||'Panel Bot WA';
  document.getElementById('renew-body').innerHTML=`
    <div class="fg"><label class="fl">Username Panel</label><input class="fi" id="rn-username" placeholder="contoh: botku123" type="text"><div class="fhint">Harus persis sama dengan saat beli.</div></div>
    <div class="fg"><label class="fl">Paket ${escapeHtml(panelTitle)}</label><select class="fi" id="rn-durasi" style="cursor:pointer">${buildPanelRenewOptions()}</select><div class="fhint">Harga perpanjang otomatis mengikuti harga/varian produk Panel yang diubah dari Admin.</div></div>
    <div class="fg"><label class="fl">Nomor WA Kamu</label><input class="fi" id="rn-wa" placeholder="628xxxxxxxxxx" type="tel"></div>
    <button class="btn-order" style="margin-top:4px" onclick="submitRenew()">🔄 Perpanjang Sekarang</button>
    <div class="wa-note" style="margin-top:9px">Kamu akan diarahkan ke <strong>CS Admin</strong> ✅</div>`;
}
function submitRenew(){
  const username=document.getElementById('rn-username').value.trim();
  const durasi=document.getElementById('rn-durasi').value;
  const wa=document.getElementById('rn-wa').value.trim();
  if(!username||!wa){showToast('⚠️ Lengkapi username dan nomor WA!');return;}
  const msg=`🔄 *PERPANJANG PANEL BOT WA*\n━━━━━━━━━━━━━━━━━━\nUsername  : ${username}\nPaket RAM : ${durasi}\nNomor WA  : ${wa}\n━━━━━━━━━━━━━━━━━━\n🛒 _Via Yonz Official_`;
  window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`,'_blank');
}

/* =====================================================
   PERPANJANG SEWA BOT
   ===================================================== */
function openRenewBotModal(){renderRenewBotForm();document.getElementById('renew-bot-overlay').classList.add('open');}
function closeRenewBotModal(){document.getElementById('renew-bot-overlay').classList.remove('open');}
function renderRenewBotForm(){
  document.getElementById('renew-bot-body').innerHTML=`
    <div class="fg"><label class="fl">Nomor WA Bot / Grup</label><input class="fi" id="rb-grup" placeholder="Contoh: Grup Gaming Squad" type="text"><div class="fhint">Nama grup atau nomor WA bot yang aktif.</div></div>
    <div class="fg"><label class="fl">Durasi Perpanjangan</label><select class="fi" id="rb-durasi" style="cursor:pointer"><option value="1 Hari — Rp500">1 Hari — Rp500</option><option value="3 Hari — Rp2.000">3 Hari — Rp2.000</option><option value="5 Hari — Rp3.500">5 Hari — Rp3.500</option><option value="7 Hari — Rp4.000">7 Hari — Rp4.000</option><option value="14 Hari — Rp6.000">14 Hari — Rp6.000</option><option value="1 Bulan — Rp7.000">1 Bulan — Rp7.000</option><option value="3 Bulan — Rp26.000">3 Bulan — Rp26.000</option><option value="1 Tahun — Rp40.000">1 Tahun — Rp40.000</option></select></div>
    <div class="fg"><label class="fl">Nomor WA Kamu</label><input class="fi" id="rb-wa" placeholder="628xxxxxxxxxx" type="tel"></div>
    <button class="btn-order" style="margin-top:4px" onclick="submitRenewBot()">🤖 Perpanjang Sekarang</button>
    <div class="wa-note" style="margin-top:9px">Kamu akan diarahkan ke <strong>CS Admin</strong> ✅</div>`;
}
function submitRenewBot(){
  const grup=document.getElementById('rb-grup').value.trim();
  const durasi=document.getElementById('rb-durasi').value;
  const wa=document.getElementById('rb-wa').value.trim();
  if(!grup||!wa){showToast('⚠️ Lengkapi nama grup dan nomor WA!');return;}
  const msg=`🤖 *PERPANJANG SEWA BOT WA*\n━━━━━━━━━━━━━━━━━━\nGrup/Bot  : ${grup}\nDurasi    : ${durasi}\nNomor WA  : ${wa}\n━━━━━━━━━━━━━━━━━━\n🛒 _Via Yonz Official_`;
  window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(msg)}`,'_blank');
}

/* =====================================================
   TRACK ORDER
   ===================================================== */
function openTrackModal(){renderTrackForm();document.getElementById('track-overlay').classList.add('open');}
function closeTrackModal(){document.getElementById('track-overlay').classList.remove('open');}
function renderTrackForm(result){
  const body=document.getElementById('track-body');
  body.innerHTML=`
    <div class="fg"><label class="fl">Nomor WA atau ID Transaksi</label><input class="fi" id="track-input" placeholder="0812xxxxxxxx  atau  TRX-xxxxxx" type="text" value="${result?escapeHtml(result._query||''):''}"></div>
    <button class="btn-order" style="margin-top:0" onclick="submitTrack()">🔍 Cari Order</button>
    ${result?renderTrackResult(result):''}
    <div style="margin-top:15px"></div>
    <div class="wa-note">Tidak menemukan order? <span style="color:var(--purple-light);cursor:pointer" onclick="contactAdmin()">Hubungi admin</span></div>`;
}
async function submitTrack(){
  const q=document.getElementById('track-input').value.trim();
  if(!q){showToast('⚠️ Masukkan nomor WA atau ID transaksi!');return;}
  document.getElementById('track-body').innerHTML=`<div style="text-align:center;padding:24px"><div style="font-size:22px;margin-bottom:8px">🔍</div><div style="font-size:12px;color:var(--muted)">Mencari order...</div></div>`;
  try{
    const data=await dbGet('store-orders');
    // FIX: normalisasi data dari Firebase yang bisa berupa object atau array
    const orders=normalizeArray(data);
    const found=orders.filter(o=>o&&((o.wa&&o.wa.replace(/\D/g,'').includes(q.replace(/\D/g,'')))||(o.id&&o.id.toLowerCase().includes(q.toLowerCase()))));
    renderTrackForm(found.length?{_query:q,found}:{_query:q,found:[],notFound:true});
  }catch{renderTrackForm({_query:q,found:[],error:true});}
}
function renderTrackResult(result){
  if(result.error)return`<div class="result-card"><div class="inapp-empty">❌ Gagal mengambil data. Hubungi admin.</div></div>`;
  if(result.notFound||!result.found||!result.found.length)return`<div class="result-card"><div style="text-align:center;padding:16px 0"><div style="font-size:26px;margin-bottom:8px">📭</div><div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:4px">Order tidak ditemukan</div><div style="font-size:11px;color:var(--muted);line-height:1.6">Pastikan nomor WA atau ID transaksi benar.</div><button class="btn-order" style="margin-top:14px;width:auto;padding:10px 20px;font-size:12px" onclick="contactAdmin()">💬 Hubungi Admin</button></div></div>`;
  return result.found.map(o=>{
    const sc=o.status==='aktif'?'ok':o.status==='expired'?'expired':'warn';
    return`<div class="result-card"><div class="result-row"><span class="result-label">ID Order</span><span class="result-val">${escapeHtml(o.id||'-')}</span></div><div class="result-row"><span class="result-label">Produk</span><span class="result-val">${escapeHtml(o.produk||'-')}</span></div><div class="result-row"><span class="result-label">Durasi</span><span class="result-val">${escapeHtml(o.durasi||'-')}</span></div><div class="result-row"><span class="result-label">Tanggal</span><span class="result-val">${escapeHtml(o.tanggal||'-')}</span></div><div class="result-row"><span class="result-label">Aktif s/d</span><span class="result-val">${escapeHtml(o.expiry||'-')}</span></div><div class="result-row"><span class="result-label">Status</span><span class="result-val ${sc}">${escapeHtml(o.status||'-')}</span></div></div>`;
  }).join('');
}

/* =====================================================
   AI CS CHAT — Prompt-based Local CS
   ===================================================== */

// Prompt persona CS — bisa disesuaikan dari Admin Panel
let CS_SYSTEM_PROMPT = `Kamu adalah AI chat assistant Yonz Official bernama "Una" 🤖

IDENTITAS:
- Nama: Una
- Toko: Yonz Official
- Karakter: pintar, santai, responsif, sopan, nyambung diajak ngobrol, dan tidak kaku
- Bahasa utama: Indonesia kasual yang sopan. Ikuti gaya bicara customer, tapi jangan kasar berlebihan

PERAN UTAMA:
- Kamu bukan hanya CS jualan. Kamu boleh merespons hampir semua perkataan customer secara natural
- Boleh membantu ngobrol ringan, menjawab pertanyaan umum, memberi saran sederhana, menjelaskan sesuatu, merapikan kata-kata, dan membantu customer memahami produk
- Jika customer curhat, bingung, atau bertanya di luar produk, jawab tetap ramah dan relevan
- Jika customer bertanya tentang produk, harga, stok, cara order, pembayaran, atau aktivasi, gunakan data produk dari web sebagai sumber utama

BATASAN PENTING:
- Jangan mengarang harga, stok, promo, garansi, bonus, atau janji aktivasi jika tidak ada datanya
- Jangan mengaku sebagai manusia. Cukup jawab natural tanpa menyebut OpenAI/API
- Jangan membantu hal yang berbahaya, ilegal, penipuan, pornografi non-konsensual, atau merugikan orang lain
- Kalau butuh keputusan admin, arahkan customer ke WhatsApp admin

GAYA MENJAWAB:
- Jawab singkat, jelas, dan natural
- Maksimal 2-5 kalimat kecuali customer minta penjelasan panjang
- Boleh pakai emoji secukupnya, jangan berlebihan
- Tidak harus selalu jualan. Utamakan menjawab maksud customer dulu
- Kalau customer cuma menyapa, balas seperti teman ngobrol yang ramah
- Kalau customer marah, tenangkan dulu lalu bantu cari solusi

CONTOH ARAH JAWABAN:
Customer: halo
Jawab: Halo kak 👋 Ada yang bisa Una bantu hari ini?

Customer: lagi gabut
Jawab: Wah sama kak, kadang gabut tuh paling enak cari hiburan dikit 😄 Mau ngobrol, tanya-tanya produk, atau Una bantu cari ide?

Customer: harga bot berapa?
Jawab: Untuk harga bot, Una cek dari data produk yang tersedia ya kak. Kalau mau, kakak bisa pilih paket sesuai durasi yang ada di katalog web.

Customer: kamu siapa?
Jawab: Aku Una, AI chat assistant dari Yonz Official. Aku bisa bantu jawab pertanyaan, ngobrol, dan bantu info produk kak.`

// Nama CS AI (bisa diubah dari admin panel)
let CS_AI_NAME = 'Una';
// Flag aktif/nonaktif AI CS
let CS_AI_ACTIVE = true;

// Riwayat chat untuk konteks AI (max 10 pesan terakhir)
let chatHistory = [];
let chatOpen = false;
let chatInit = false;
let chatTypingTimeout = null;
let aiChatEnabled = true; // selalu true, berbasis prompt lokal

function toggleChat(){
  chatOpen=!chatOpen;
  document.getElementById('chat-window').classList.toggle('open',chatOpen);
  if(chatOpen){
    document.getElementById('chat-notif').style.display='none';
    if(!chatInit)initChat();
  }
}

function initChat(){
  chatInit=true;
  chatHistory=[];
  const msgs=document.getElementById('chat-messages');
  msgs.innerHTML='';
  addTypingIndicator();
  setTimeout(()=>{
    removeTypingIndicator();
    const greet=`Halo kak! 👋 Aku ${CS_AI_NAME}, AI chat assistant dari Yonz Official. Mau ngobrol, tanya sesuatu, atau butuh bantuan soal produk?`;
    addChatMsg('admin',greet,CS_AI_NAME);
    chatHistory.push({role:'assistant',content:greet});
  },900);
}

function addChatMsg(from, text, senderName=''){
  const msgs=document.getElementById('chat-messages');
  const div=document.createElement('div');
  div.className=`chat-msg ${from}`;
  const formatted=escapeHtml(text)
    .replace(/\n/g,'<br>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  div.innerHTML=formatted+`<div class="chat-msg-time">${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
}

function addTypingIndicator(){
  removeTypingIndicator();
  const msgs=document.getElementById('chat-messages');
  const t=document.createElement('div');
  t.className='chat-typing';t.id='chat-typing';
  t.innerHTML='<span></span><span></span><span></span>';
  msgs.appendChild(t);msgs.scrollTop=msgs.scrollHeight;
}

function removeTypingIndicator(){
  const t=document.getElementById('chat-typing');if(t)t.remove();
  if(chatTypingTimeout){clearTimeout(chatTypingTimeout);chatTypingTimeout=null;}
}

async function sendChatMsg(){
  const inp=document.getElementById('chat-input');
  const txt=inp.value.trim();
  if(!txt)return;

  addChatMsg('user',txt);
  inp.value='';inp.style.height='auto';
  chatHistory.push({role:'user',content:txt});
  if(chatHistory.length>10)chatHistory=chatHistory.slice(-10);

  addTypingIndicator();

  try{
    // Gunakan AI jika aktif, fallback ke keyword jika tidak
    const reply = CS_AI_ACTIVE ? await askLocalCS(txt) : getFallbackReply(txt.toLowerCase());
    removeTypingIndicator();
    addChatMsg('admin',reply,CS_AI_NAME);
    chatHistory.push({role:'assistant',content:reply});
    if(chatHistory.length>10)chatHistory=chatHistory.slice(-10);
  }catch(err){
    removeTypingIndicator();
    const fallback=getFallbackReply(txt.toLowerCase());
    addChatMsg('admin',fallback,CS_AI_NAME);
    console.warn('AI CS error, using fallback:',err);
  }
}

// =====================================================
// askLocalCS — Rule-based CS berbasis CS_SYSTEM_PROMPT
// Tidak memerlukan API eksternal, semua berjalan lokal
// Prompt dari admin panel digunakan sebagai basis konteks
// =====================================================
function parsePromptContext(){
  // Ekstrak info dari CS_SYSTEM_PROMPT yang diatur admin
  const ctx = { name: CS_AI_NAME, products: [], payment: [], cara_order: '', aktivasi: '', support: '' };
  const lines = CS_SYSTEM_PROMPT.split('\n');
  let section = '';
  for(const line of lines){
    const l = line.trim();
    if(!l) continue;
    if(/produk.*dijual|product/i.test(l)) section='produk';
    else if(/cara order|langkah/i.test(l)) { section='order'; ctx.cara_order = l.replace(/cara order.*?:/i,'').trim(); }
    else if(/metode.*bayar|pembayaran|bayar/i.test(l)) { section='bayar'; ctx.payment.push(l); }
    else if(/aktivasi/i.test(l)) { section='aktivasi'; ctx.aktivasi = l; }
    else if(/support/i.test(l)) { section='support'; ctx.support = l; }
    else if(section==='produk' && /^\d+\./.test(l)){
      const m = l.match(/^\d+\.\s*(.+)/);
      if(m) ctx.products.push(m[1]);
    }
  }
  return ctx;
}

async function askLocalCS(userMessage){
  // Simulasi delay natural (300-800ms)
  await new Promise(r => setTimeout(r, 300 + Math.random()*500));
  const lower = userMessage.toLowerCase();
  const ctx = parsePromptContext();
  const nm = ctx.name || CS_AI_NAME;

  // ── Salam ──
  if(/^(halo|hai|hi|hey|hello|p+|assalam|wkwk|hola)\b/i.test(lower))
    return `Halo kak! 👋 Aku ${nm}, CS dari Yonz Official. Ada yang bisa aku bantu hari ini? Mau tanya produk, harga, atau cara order? 😊`;

  // ── Terima kasih ──
  if(/terima kasih|makasih|thanks|thx|tq/i.test(lower))
    return `Sama-sama kak! 😊 Kalau ada yang perlu ditanyain lagi, ${nm} siap bantu ya~`;

  // ── Produk apa saja ──
  if(/produk.*apa|jual.*apa|ada.*apa|list.*produk|apa.*yang.*dijual/i.test(lower)){
    const prods = ctx.products.length ? ctx.products.map((p,i)=>`${i+1}. ${p}`).join('\n') : '• Sewa Bot WA\n• Panel Pterodactyl\n• Script Bot';
    return `Produk kita ada:\n${prods}\n\nMau info lebih lanjut yang mana kak? 😊`;
  }

  // ── Harga ──
  if(/harga|berapa|price|tarif|biaya|murah|mahal/i.test(lower)){
    if(/bot|sewa/i.test(lower))
      return extractSection('bot')||`Harga Sewa Bot kak:\n• 1 hari: Rp500\n• 3 hari: Rp2.000\n• 7 hari: Rp4.000\n• 1 bulan: Rp7.000\n• 1 tahun: Rp40.000\n\nMurah kan? 😄`;
    if(/panel|pterodactyl|ptero/i.test(lower))
      return extractSection('panel')||`Harga Panel Pterodactyl kak:\n• 1 minggu: Rp2.000\n• 1 bulan: Rp7.000\n• Permanen: Rp50.000\n\nVPS legal, uptime 99.9%! 🖥️`;
    if(/sc|source.*code|script/i.test(lower))
      return extractSection('sc')||`SC Evernight AI: Rp75.000 kak 📦\nBeli sekali, update gratis selamanya! Tanpa enkripsi, 1800+ fitur langsung pakai.`;
    return `Harga produk kita kak:\n• 🤖 Sewa Bot: mulai Rp500/hari\n• 🖥️ Panel: mulai Rp2.000/minggu\n• 📦 Script: Rp75.000\n\nMau info produk yang mana? 😊`;
  }

  // ── Bot ──
  if(/bot|sewa.*bot|bot.*wa|whatsapp.*bot/i.test(lower))
    return `Sewa Bot kita punya 1800+ fitur kak 🤖\nGame, sticker, info, moderasi grup — lengkap banget!\nHarga mulai Rp500/hari aja, langsung aktif setelah bayar ke grup kamu 🔥\n\nMau sewa berapa lama kak?`;

  // ── Panel ──
  if(/panel|pterodactyl|ptero|vps/i.test(lower))
    return `Panel Pterodactyl Premium kita kak 🖥️\nVPS legal, uptime 99.9%, RAM 2GB-Unlimited.\nMulai Rp2.000/minggu, cocok buat host bot WA kamu sendiri!\n\nMau coba berapa lama?`;

  // ── Script ──
  if(/sc|source.*code|script|source/i.test(lower))
    return `SC itachi AI — Rp80.000 kak 📦\nFull Script tanpa enkripsi, 1800+ fitur, update gratis selamanya.\nPas banget buat yang mau develop bot sendiri!`;

  // ── Cara order ──
  if(/cara.*order|gimana.*order|cara.*beli|order.*gimana|langkah|step/i.test(lower))
    return `Cara order gampang kak 🛒\n1. Klik produk yang kamu mau\n2. Pilih varian/durasi\n3. Klik "Beli Sekarang"\n4. Isi data (nama, no WA, grup)\n5. Pilih metode bayar & bayar\n6. Upload bukti pembayaran\n✅ Aktivasi < 30 menit setelah bukti dikonfirmasi!`;

  // ── Pembayaran ──
  if(/bayar|transfer|payment|metode.*bayar|qris|gopay|dana|ovo/i.test(lower))
    return `Metode pembayaran kita kak 💳\n• DANA\n• GoPay\n• OVO\n• QRIS (semua bank)\n\nSetelah bayar, upload bukti di web ya, aktivasi < 30 menit! ⚡`;

  // ── Aktivasi / berapa lama ──
  if(/kapan.*aktif|berapa.*lama.*aktif|lama.*aktivasi|aktivasi.*berapa/i.test(lower))
    return `Aktivasi < 30 menit ya kak ⚡ Setelah bukti bayar kamu upload dan dikonfirmasi admin, langsung aktif!`;

  // ── Support / kontak ──
  if(/contact|kontak|admin|cs.*lain|hubungi|wa.*admin|whatsapp/i.test(lower))
    return `Bisa hubungi admin langsung kak 📲\nKlik tombol "Lanjut Chat via WhatsApp" di bawah ya, ${nm} sambungkan ke admin! 😊`;

  // ── Fitur bot ──
  if(/fitur|feature|command|cmd|1800|lengkap/i.test(lower))
    return `Bot kita punya 1800+ command aktif kak 🔥\nAda: game RPG, sticker maker, download media, info cuaca, moderasi grup, dan masih banyak lagi!\n\nMau sewa atau tanya lebih detail?`;

  // ── Default ──
  return `Hmm, ${nm} kurang ngerti maksud kakak nih 😅\nCoba tanya tentang:\n• Produk & harga\n• Cara order\n• Metode pembayaran\n• Aktivasi\n\nAtau langsung chat admin via WhatsApp ya kak! 📲`;
}

// Helper: cari info harga dari CS_SYSTEM_PROMPT berdasarkan keyword
function extractSection(keyword){
  const lines = CS_SYSTEM_PROMPT.split('\n');
  const kw = { bot:'sewa bot|bot wa', panel:'panel|pterodactyl', sc:'Script|sc evernight' }[keyword] || keyword;
  const re = new RegExp(kw,'i');
  let found = false, result = [];
  for(const line of lines){
    if(re.test(line)){ found=true; result=[line.trim()]; continue; }
    if(found){
      if(/^\d+\.\s/.test(line.trim()) && result.length>1) break;
      if(line.trim()) result.push(line.trim());
      if(result.length>=6) break;
    }
  }
  return found && result.length>1 ? result.join('\n') : null;
}

// Fallback replies jika AI CS dimatikan dari admin
function getFallbackReply(lower){
  if(lower.includes('harga')||lower.includes('berapa'))
    return `Harga produk kita mulai dari Rp500 kak 😊\n• Sewa Bot: Rp500/hari\n• Panel: Rp2.000/minggu\n• SC Evernight: Rp75.000\n\nMau yang mana?`;
  if(lower.includes('bot')||lower.includes('sewa'))
    return `Sewa Bot kita ada 1800+ fitur kak 🤖 Mulai Rp500/hari aja, langsung aktif setelah bayar!`;
  if(lower.includes('panel'))
    return `Panel Pterodactyl premium VPS legal kak 🖥️ Mulai Rp2.000/minggu, uptime 99.9%!`;
  if(lower.includes('bayar')||lower.includes('transfer'))
    return `Bisa bayar via DANA, GoPay, OVO, atau QRIS kak 💳 Setelah bayar upload bukti di web ya!`;
  if(lower.includes('halo')||lower.includes('hai')||lower.includes('hi'))
    return `Halo kak! 👋 Ada yang bisa ${CS_AI_NAME} bantu?`;
  return `Maaf kak, ${CS_AI_NAME} lagi ada gangguan koneksi 😅 Coba tanya lagi atau langsung WA admin ya biar lebih cepat!`;
}

function chatKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMsg();}}
function autoResizeChat(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,65)+'px';}
function lanjutWhatsApp(){contactAdmin();}


/* =====================================================
   TOAST
   ===================================================== */
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(10px)';},2800);
}

/* =====================================================
   ESCAPE HTML (dipindah ke atas untuk dipakai semua fungsi)
   ===================================================== */
function escapeHtml(t){
  if(typeof t!=='string')t=String(t||'');
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function getProductLabel(){return (PRODUCT_LABEL||STORE_NAME||'Yonz Official').trim();}

/* =====================================================
   LOAD DATA
   ===================================================== */
async function loadStoreData(){
  try{
    const [info,kontak,prods,imgCfg,heroCfg,payCfg,adCfg]=await Promise.all([
      dbGet('store-info'),dbGet('store-kontak'),dbGet('store-produk'),dbGet('store-img-produk'),dbGet('store-hero-slides'),dbGet('store-payment'),dbGet('store-ad-media'),
    ]);
    await loadAllProductReviews();
    if(kontak?.adminWa)ADMIN_WA=kontak.adminWa;
    if(kontak?.waMessage)WA_DEFAULT_MESSAGE=kontak.waMessage;
    if(kontak?.telegramUser)TELEGRAM_USER=String(kontak.telegramUser).replace(/^@/,'');
    if(kontak?.csChannels)CS_CHANNELS={whatsapp:true,telegram:false,...kontak.csChannels};
    if(kontak?.grupBuyer)GRUP_BUYER=kontak.grupBuyer;
    if(info?.nama)STORE_NAME=info.nama;
    if(info&&Object.prototype.hasOwnProperty.call(info,'productLabel'))PRODUCT_LABEL=info.productLabel||'';
    setupStoreMusic(info?.musicUrl||'');
    const loadingTitleEl=document.getElementById('ls-name');
    const loadingSubEl=document.getElementById('ls-sub');
    if(loadingTitleEl)loadingTitleEl.textContent=(info?.loadingTitle||info?.nama||STORE_NAME||'Yonz Official');
    if(loadingSubEl)loadingSubEl.textContent=(info?.loadingSub||'Premium Bot Store');
    let needRerender=false;
    if(payCfg)PAYMENT_CFG={...PAYMENT_CFG,...payCfg};
    if(adCfg){adMedia={...adMedia,...adCfg};needRerender=true;}
    if(prods&&prods.length){
      products=prods.map(p=>{const imgOverride=imgCfg?.[p.id];return{...p,imgUrl:imgOverride||p.imgUrl||''};});
      needRerender=true;
    }else if(imgCfg){products=products.map(p=>({...p,imgUrl:imgCfg[p.id]||''}));needRerender=true;}
    if(heroCfg&&heroCfg.length){heroSlides=heroCfg;needRerender=true;}
    if(info?.nama){
      const avatarEl=document.querySelector('.nav-logo .avatar');if(avatarEl)avatarEl.textContent=(info.nama||'U').charAt(0).toUpperCase();
      const nameEl=document.querySelector('.nav-logo .store-name-text');if(nameEl)nameEl.textContent=info.nama;
      document.title=info.nama;
    }
    const marquee=await dbGet('store-marquee');
    if(marquee&&marquee.length){const inner=document.querySelector('.marquee-inner');if(inner){const doubled=[...marquee,...marquee];inner.innerHTML=doubled.map((t,i)=>`<span>${t}</span>${i<doubled.length-1?'<span class="marquee-dot">•</span>':''}`).join('');}}
    const drawer=await dbGet('store-drawer');renderDrawer(drawer&&drawer.length?drawer:null);
    if(needRerender){
      renderProductGrid();buildHeroSlides();
      setTimeout(()=>{addViewCounts&&addViewCounts();},100);
    }else{
      renderProductGrid();
    }
    // Load AI CS config & SC download config dari admin panel
    loadAiCsAndScConfig();
  }catch(e){console.error('loadStoreData error:',e);}
}

/* =====================================================
   BG FROM ADMIN
   ===================================================== */
const MESH_CSS={purple:'radial-gradient(ellipse at 20% 20%,rgba(124,58,237,.6) 0%,transparent 50%),linear-gradient(135deg,#05050f,#0d0520)',cyan:'radial-gradient(ellipse at 20% 20%,rgba(0,229,255,.4) 0%,transparent 50%),linear-gradient(135deg,#020d12,#061220)',fire:'radial-gradient(ellipse at 20% 20%,rgba(239,68,68,.5) 0%,transparent 50%),linear-gradient(135deg,#0f0505,#1a0a05)',ocean:'radial-gradient(ellipse at 20% 20%,rgba(6,182,212,.5) 0%,transparent 50%),linear-gradient(135deg,#020d10,#050d1a)'};
async function applyBg(){
  try{
    const cfg=await dbGet('store-tampilan')||{};
    const allowed=['normal','keren','ringan','rgb'];
    const mode=allowed.includes(cfg.mode)?cfg.mode:'normal';
    document.body.classList.remove('mode-normal','mode-keren','mode-ringan','mode-rgb');
    document.body.classList.add('mode-'+mode);
    if(cfg.accent)document.documentElement.style.setProperty('--purple',cfg.accent);
    if(cfg.accent2)document.documentElement.style.setProperty('--accent',cfg.accent2);
    if(cfg.avatar){const avatarEl=document.querySelector('.nav-logo .avatar');if(avatarEl)avatarEl.textContent=cfg.avatar;}
    if(!cfg.background)return;
    const bg=cfg.background;
    if(bg.type==='gradient'&&bg.value)document.body.style.background=bg.value;
    else if(bg.type==='image'&&bg.url){const op=Math.min(((bg.opacity||35)/100),0.38);document.body.style.backgroundImage=`linear-gradient(rgba(0,0,0,${op}),rgba(0,0,0,${op})),url('${bg.url}')`;document.body.style.backgroundSize='cover';document.body.style.backgroundPosition='center';document.body.style.backgroundAttachment='scroll';}
    else if(bg.type==='mesh')document.body.style.background=MESH_CSS[bg.theme||'purple'];
  }catch(e){}
}

/* =====================================================
   PREMIUM FEATURES JS
   ===================================================== */


function closeLoadingAdPopup(){
  const pop=document.getElementById('loading-ad-popup');
  if(pop){pop.classList.remove('show');pop.setAttribute('aria-hidden','true');}
  window.__loadingAdVisible=false;
  if(window.__loadingAdHasNext && window.__loadingAdHasNext()) setTimeout(showLoadingAdPopup,650);
}
function __loadingAdQueueFromCfg(cfg){
  const arr=[];
  if(cfg&&(cfg.img||cfg.title||cfg.text||cfg.link))arr.push({img:cfg.img,title:cfg.title,text:cfg.text,btn:cfg.btn,link:cfg.link});
  if(cfg&&Array.isArray(cfg.ads))cfg.ads.forEach(a=>{if(a&&(a.img||a.title||a.text||a.link))arr.push(a);});
  return arr;
}
async function showLoadingAdPopup(){
  try{
    if(window.__loadingAdVisible)return;
    if(!window.__loadingAdCfg){
      window.__loadingAdCfg=await dbGet('store-loading-ad');
      window.__loadingAdQueue=__loadingAdQueueFromCfg(window.__loadingAdCfg);
      window.__loadingAdIndex=0; window.__loadingAdRound=0;
    }
    const cfg=window.__loadingAdCfg, q=window.__loadingAdQueue||[];
    const max=Math.max(1,parseInt(cfg?.maxShows||1)||1);
    window.__loadingAdHasNext=()=>cfg&&cfg.active===true&&q.length&&(window.__loadingAdRound||0)<max;
    if(!cfg||cfg.active!==true||!q.length||(window.__loadingAdRound||0)>=max)return;
    const ad=q[window.__loadingAdIndex||0]||q[0];
    const pop=document.getElementById('loading-ad-popup');
    const img=document.getElementById('loading-ad-img');
    const title=document.getElementById('loading-ad-title');
    const text=document.getElementById('loading-ad-text');
    const join=document.getElementById('loading-ad-join');
    if(!pop||!img||!title||!text||!join)return;
    if(ad.img){img.src=ad.img;img.style.display='block';}else{img.removeAttribute('src');img.style.display='none';}
    title.textContent=ad.title||'Join Saluran Kami';
    text.textContent=ad.text||'Ikuti saluran agar tidak ketinggalan update terbaru.';
    join.textContent=ad.btn||'Join Saluran';
    if(ad.link){join.href=ad.link;join.style.display='inline-flex';}else{join.style.display='none';}
    pop.classList.add('show'); pop.setAttribute('aria-hidden','false'); window.__loadingAdVisible=true;
    window.__loadingAdIndex=(window.__loadingAdIndex||0)+1;
    if(window.__loadingAdIndex>=q.length){window.__loadingAdIndex=0;window.__loadingAdRound=(window.__loadingAdRound||0)+1;}
  }catch(e){console.error('showLoadingAdPopup:',e);}
}

/* --- LOADING SCREEN --- */
async function initLoadingScreen(){
  const screen=document.getElementById('loading-screen');
  const fill=document.getElementById('ls-bar-fill');
  let duration=3000;
  try{
    const info=await dbGet('store-info');
    const loadingTitleEl=document.getElementById('ls-name');
    const loadingSubEl=document.getElementById('ls-sub');
    if(loadingTitleEl)loadingTitleEl.textContent=(info?.loadingTitle||info?.nama||STORE_NAME||'Yonz Official');
    if(loadingSubEl)loadingSubEl.textContent=(info?.loadingSub||'Premium Bot Store');
    const delaySeconds=Number(info?.loadingDelay||3);
    duration=Math.max(1000, Math.min(30000, delaySeconds*1000));
  }catch(e){console.error('initLoadingScreen config:',e);}
  const start=Date.now();
  if(fill)fill.style.width='0%';
  const iv=setInterval(()=>{
    const elapsed=Date.now()-start;
    const progress=Math.min(100,(elapsed/duration)*100);
    if(fill)fill.style.width=progress+'%';
    if(progress>=100){
      clearInterval(iv);
      if(screen)screen.classList.add('hidden');
      setTimeout(showLoadingAdPopup,250);
    }
  },80);
}

/* --- MUSIC STORE --- */
function setupStoreMusic(url){
  MUSIC_URL=(url||'').trim();
  const audio=document.getElementById('store-music');
  const btn=document.getElementById('music-toggle');
  if(audio){
    if(MUSIC_URL && audio.src!==MUSIC_URL)audio.src=MUSIC_URL;
    if(!MUSIC_URL){audio.removeAttribute('src');audio.load();}
  }
  MUSIC_PLAYING=false;
  if(btn){btn.textContent='🎶 MUSIK OFF';btn.classList.remove('on');}
}
async function toggleStoreMusic(ev){
  if(ev)ev.stopPropagation();
  const audio=document.getElementById('store-music');
  const btn=document.getElementById('music-toggle');
  if(!audio)return;
  if(!MUSIC_URL){
    showToast('URL musik belum diatur di admin.');
    return;
  }
  try{
    if(audio.paused){
      if(!audio.src)audio.src=MUSIC_URL;
      await audio.play();
      MUSIC_PLAYING=true;
      if(btn){btn.textContent='🎶 MUSIK ON';btn.classList.add('on');}
    }else{
      audio.pause();
      MUSIC_PLAYING=false;
      if(btn){btn.textContent='🎶 MUSIK OFF';btn.classList.remove('on');}
    }
  }catch(e){
    console.error('Music play error:',e);
    showToast('Musik gagal diputar. Cek URL musiknya.');
  }
}


/* --- PARTICLE SYSTEM --- */
function initParticles(){
  const canvas=document.getElementById('particle-canvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  let W,H,particles=[],orbs=[];

  const COLORS=['rgba(124,58,237,','rgba(168,85,247,','rgba(217,70,239,','rgba(255,255,255,'];

  class Particle{
    constructor(){this.reset(true);}
    reset(init){
      this.x=Math.random()*W;
      this.y=init?Math.random()*H:H+5;
      this.r=Math.random()*1.6+.3;
      this.vx=(Math.random()-.5)*.22;
      this.vy=-Math.random()*.35-.08;
      this.alpha=Math.random()*.55+.1;
      this.color=COLORS[Math.floor(Math.random()*COLORS.length)];
      this.twinkle=Math.random()*Math.PI*2;
    }
    update(){
      this.x+=this.vx;this.y+=this.vy;
      this.twinkle+=.035;
      this.alpha=.08+Math.abs(Math.sin(this.twinkle))*.45;
      if(this.y<-5||this.x<-5||this.x>W+5)this.reset(false);
    }
    draw(){
      ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
      ctx.fillStyle=this.color+this.alpha+')';ctx.fill();
    }
  }

  class GlowOrb{
    constructor(){this.reset();}
    reset(){
      this.x=Math.random()*W;this.y=Math.random()*H;
      this.r=Math.random()*3+2;
      this.vx=(Math.random()-.5)*.12;this.vy=(Math.random()-.5)*.12;
      this.alpha=Math.random()*.2+.04;this.pulse=Math.random()*Math.PI*2;
    }
    update(){
      this.x+=this.vx;this.y+=this.vy;this.pulse+=.018;
      if(this.x<0||this.x>W)this.vx*=-1;
      if(this.y<0||this.y>H)this.vy*=-1;
    }
    draw(){
      const a=this.alpha+Math.sin(this.pulse)*.07;
      const grad=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*5);
      grad.addColorStop(0,'rgba(124,58,237,'+a+')');
      grad.addColorStop(1,'rgba(124,58,237,0)');
      ctx.beginPath();ctx.arc(this.x,this.y,this.r*5,0,Math.PI*2);
      ctx.fillStyle=grad;ctx.fill();
    }
  }

  function build(){
    W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;
    // FIX: Recreate particles on resize
    const COUNT=Math.min(100,Math.floor(W*H/12000));
    particles=[];for(let i=0;i<COUNT;i++)particles.push(new Particle());
    orbs=[];for(let i=0;i<7;i++)orbs.push(new GlowOrb());
  }
  build();

  let resizeTimer;
  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(build,200);
  });

  function animate(){
    ctx.clearRect(0,0,W,H);
    orbs.forEach(o=>{o.update();o.draw();});
    particles.forEach(p=>{p.update();p.draw();});
    requestAnimationFrame(animate);
  }
  animate();
}

/* --- CURSOR GLOW (desktop) --- */
function initCursorGlow(){
  if('ontouchstart' in window)return;
  const glow=document.getElementById('cursor-glow');
  if(!glow)return;
  document.addEventListener('mousemove',e=>{
    glow.style.left=e.clientX+'px';
    glow.style.top=e.clientY+'px';
  });
}

/* --- CARD 3D TILT --- */
function initCardTilt(){
  function applyTilt(card){
    if(card._tiltInit)return; // FIX: prevent double-binding
    card._tiltInit=true;
    card.addEventListener('mousemove',e=>{
      const rect=card.getBoundingClientRect();
      const x=(e.clientX-rect.left)/rect.width-.5;
      const y=(e.clientY-rect.top)/rect.height-.5;
      card.style.transform=`perspective(700px) rotateX(${y*9}deg) rotateY(${-x*9}deg) translateY(-3px) scale(1.02)`;
      const shine=card.querySelector('.card-tilt-shine');
      if(shine){
        shine.style.background=`radial-gradient(circle at ${50+x*80}% ${50+y*80}%,rgba(255,255,255,.13) 0%,rgba(255,255,255,0) 60%)`;
      }
    });
    card.addEventListener('mouseleave',()=>{
      card.style.transform='';
      const shine=card.querySelector('.card-tilt-shine');
      if(shine)shine.style.background='';
    });
    card.addEventListener('touchstart',()=>{
      card.style.transform='translateY(-2px) scale(1.01)';
    },{passive:true});
    card.addEventListener('touchend',()=>{  // FIX: remove passive:false, touchend doesn't need preventDefault
      setTimeout(()=>{card.style.transform='';},200);
    },{passive:true});
  }
  document.querySelectorAll('.product-card').forEach(applyTilt);
  const observer=new MutationObserver(mutations=>{
    mutations.forEach(m=>{
      m.addedNodes.forEach(node=>{
        if(node.classList&&node.classList.contains('product-card'))applyTilt(node);
        if(node.querySelectorAll)node.querySelectorAll('.product-card').forEach(applyTilt);
      });
    });
  });
  const grid=document.getElementById('products-grid');
  if(grid)observer.observe(grid,{childList:true,subtree:true});
}

/* Inject shine div into every card */
function injectCardShine(){
  document.querySelectorAll('.product-card').forEach(card=>{
    if(!card.querySelector('.card-tilt-shine')){
      const shine=document.createElement('div');
      shine.className='card-tilt-shine';
      card.appendChild(shine);
    }
  });
}

/* --- SHIMMER SKELETON LOADING --- */
function showSkeletonGrid(){
  const grid=document.getElementById('products-grid');
  if(!grid)return;
  grid.innerHTML='';
  for(let i=0;i<3;i++){
    const isFeatured=i===2;
    const div=document.createElement('div');
    div.className='skel-card'+(isFeatured?' featured':'');
    div.style.gridColumn=isFeatured?'1/-1':'';
    div.innerHTML=`
      <div class="skel-img skeleton"></div>
      <div class="skel-body">
        <div class="skel-line w-80 skeleton"></div>
        <div class="skel-line w-60 skeleton"></div>
        <div class="skel-line w-40 skeleton"></div>
      </div>`;
    grid.appendChild(div);
  }
}

/* --- TYPEWRITER EFFECT --- */
let twInterval=null;
function initTypewriter(){
  // FIX: target by ID that slides create, fallback to any hero p
  const phrases=['Bot WA 1800+ Fitur Aktif','Panel Premium VPS Legal','Script Full Tanpa Enkripsi','Aktivasi Otomatis, Support 24/7','Harga Mulai Rp500 Saja!'];
  let pi=0,ci=0,deleting=false;
  if(twInterval)clearInterval(twInterval);
  
  function getTarget(){
    return document.getElementById('hero-tw-0')||document.querySelector('.hero-content p');
  }
  
  const el=getTarget();
  if(!el)return;
  el.innerHTML='<span id="tw-text"></span><span class="typewriter-cursor"></span>';
  
  function type(){
    const tw=document.getElementById('tw-text');
    if(!tw)return;
    const phrase=phrases[pi];
    if(!deleting){
      tw.textContent=phrase.slice(0,ci+1);ci++;
      if(ci===phrase.length){deleting=true;setTimeout(type,2200);return;}
    }else{
      tw.textContent=phrase.slice(0,ci-1);ci--;
      if(ci===0){deleting=false;pi=(pi+1)%phrases.length;}
    }
    setTimeout(type,deleting?45:85);
  }
  type();
}

/* --- SCROLL REVEAL --- */
let _revealObserver=null;
function initScrollReveal(){
  // FIX: disconnect old observer to avoid stale references
  if(_revealObserver)_revealObserver.disconnect();
  _revealObserver=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('visible');
        _revealObserver.unobserve(e.target);
      }
    });
  },{threshold:.08,rootMargin:'0px 0px -10px 0px'});

  // Product cards - animate on scroll
  document.querySelectorAll('.product-card').forEach((el,i)=>{
    if(el._revealDone)return;
    el.classList.add('reveal');
    el.style.transitionDelay=(i%2)*0.06+'s';
    _revealObserver.observe(el);
  });

  // Trust badges - trigger immediately since they're above fold
  document.querySelectorAll('.trust-badge').forEach((el,i)=>{
    el.classList.add('reveal');
    el.style.transitionDelay=(i*0.05)+'s';
    setTimeout(()=>el.classList.add('visible'),300+(i*50));
  });
}

/* =====================================================
   AI CS CONFIG LOADER
   ===================================================== */
async function loadAiCsAndScConfig(){
  try{
    const aiCfg = await dbGet('store-ai-cs');
    if(aiCfg){
      CS_AI_ACTIVE = aiCfg.active !== false;
      if(aiCfg.name) CS_AI_NAME = aiCfg.name;
      if(aiCfg.prompt) CS_SYSTEM_PROMPT = aiCfg.prompt;
      const nameEl = document.querySelector('.chat-head-name');
      if(nameEl) nameEl.innerHTML = CS_AI_NAME + ' <span class="chat-ai-badge">AI</span>';
      const inputEl = document.getElementById('chat-input');
      if(inputEl) inputEl.placeholder = `Tanya ${CS_AI_NAME} sesuatu...`;
    }
  }catch(e){console.warn('loadAiCsAndScConfig error:',e);}
}



/* admin-loading-control-sync-fix */
(function(){
  var started=false;
  async function safeCall(fn){try{ if(typeof window[fn]==='function') return await window[fn](); }catch(e){console.warn(fn,e);} }
  async function boot(){
    if(started)return; started=true;
    try{ if(typeof initLoadingScreen==='function') initLoadingScreen(); }catch(e){}
    await safeCall('loadStoreData');
    await safeCall('applyBg');
    try{ if(typeof buildHeroSlides==='function') buildHeroSlides(); }catch(e){}
    try{ if(typeof renderProductGrid==='function') renderProductGrid(); }catch(e){}
    setTimeout(function(){safeCall('loadStoreData');safeCall('applyBg');},1200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
