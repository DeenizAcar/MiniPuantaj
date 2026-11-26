/* Mini Puantaj - tek dosyalık uygulama mantığı */
(function () {
  'use strict';

  var SECINIZ = 'Seçiniz';
  var DURUMLAR = [SECINIZ, 'GELMEDİ', 'GELDİ', 'BİLİNMİYOR'];
  var VARSAYILAN = SECINIZ;
  var SIRA = { 'GELMEDİ': 0, 'BİLİNMİYOR': 1, 'GELDİ': 2 };
  var RENK = { 'Seçiniz': 'none', 'GELMEDİ': 'red', 'GELDİ': 'green', 'BİLİNMİYOR': 'gray' };
  var GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  var K_PERSONEL = 'mp_kaynak_personel', K_GUNLUK = 'mp_gunluk', K_ARSIV = 'mp_arsiv';

  var $ = function (id) { return document.getElementById(id); };
  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var plug = function (n) { return Cap && Cap.Plugins ? Cap.Plugins[n] : null; };

  /* ---------- Depolama ---------- */
  function oku(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Kayıt yapılamadı!'); } }

  var arsiv = oku(K_ARSIV, []);        // [{id, zaman, kayitlar:[{ad,durum}], aciklama}]
  function kaydetArsiv() { yaz(K_ARSIV, arsiv); }

  /* ---------- Personel kaynağı: Personel programı ----------
     Ana ekrana Personel programında "Puantajda Görünsün" işaretli ve pasif olmayanlar gelir.
     Web: aynı sitedeki Personel uygulamasının ps_personel kaydı okunur.
     Android: Personel uygulamasının paylaştığı liste PersonelKaynak eklentisiyle okunur.
     Son okunan liste saklanır; kaynak okunamazsa o gösterilir. */
  var personel = oku(K_PERSONEL, []);   // [{id, ad, cinsiyet, puantaj, pasif}]
  var kaynakHata = '';
  function aktifPersonel() { return personel.filter(function (p) { return p.puantaj !== false && !p.pasif; }); }
  function listeUygula(liste) {
    personel = (Array.isArray(liste) ? liste : []).filter(function (p) { return p && p.id && p.ad; }).map(function (p) {
      return { id: p.id, ad: p.ad, cinsiyet: p.cinsiyet, puantaj: p.puantaj !== false, pasif: !!p.pasif };
    });
    yaz(K_PERSONEL, personel);
    kaynakHata = '';
  }
  function personelYukle() {
    if (isNative) {
      var Kaynak = plug('PersonelKaynak');
      if (!Kaynak) { kaynakHata = 'Personel programına bağlanılamadı.'; return Promise.resolve(); }
      return Kaynak.oku().then(function (r) {
        if (r && r.json) listeUygula(JSON.parse(r.json));
        else if (!personel.length) kaynakHata = 'Personel programı henüz liste paylaşmadı. Personel programını bir kez açınız.';
      }).catch(function (e) {
        var kod = e && e.code;
        kaynakHata = kod === 'IZIN' ? 'Personel programı bu uygulamaya izin vermedi.'
          : 'Personel programı bulunamadı. Personel programını kurup en az bir kez açınız.';
      });
    }
    var w = oku('ps_personel', null);
    if (w) listeUygula(w);
    else kaynakHata = 'Personel programında kayıt bulunamadı.';
    return Promise.resolve();
  }
  function personelYenile() {
    return personelYukle().then(function () { if (aktifEkran === 'scrMain') renderMain(); });
  }

  /* ---------- Yardımcılar ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function gunAnahtar(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function tarihYaz(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function saatYaz(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function trKucuk(s) { return (s || '').toLocaleLowerCase('tr-TR'); }
  function adSirala(a, b) { return a.ad.localeCompare(b.ad, 'tr', { sensitivity: 'base' }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var toastT;
  function toast(m) {
    var t = $('toast'); t.textContent = m; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 2500);
  }

  /* ---------- Günlük durum ---------- */
  // gunluk: {tarih, gonderildi, zaman, durumlar:{id:durum}, aciklama, kayitliIdler:[...]}
  var aktifGun, gunluk, taslak, taslakAciklama;

  function gunuYukle() {
    aktifGun = gunAnahtar();
    var g = oku(K_GUNLUK, null);
    gunluk = (g && g.tarih === aktifGun) ? g : { tarih: aktifGun, gonderildi: false, durumlar: {}, aciklama: '', kayitliIdler: [] };
    taslak = {};
    personel.forEach(function (p) { taslak[p.id] = gunluk.durumlar[p.id] || VARSAYILAN; });
    taslakAciklama = gunluk.aciklama || '';
    $('txtAciklama').value = taslakAciklama;
  }

  function gunKontrol() {
    if (gunAnahtar() !== aktifGun) { gunuYukle(); renderMain(); }
  }

  /* ---------- Ekranlar ---------- */
  var aktifEkran = 'scrMain';
  function ekranGoster(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    aktifEkran = id;
    menuKapat();
    if (id === 'scrMain') { gunKontrol(); renderMain(); }
    if (id === 'scrArsiv') renderArsiv();
  }

  /* ---------- ANA EKRAN ---------- */
  function renderMain() {
    var now = new Date();
    $('mainDate').textContent = tarihYaz(now) + ' ' + GUNLER[now.getDay()];
    $('mainSent').textContent = gunluk.gonderildi ? ('Rapor gönderildi : ' + saatYaz(new Date(gunluk.zaman))) : '';

    var liste = aktifPersonel().sort(adSirala);
    var tb = $('mainBody'); tb.innerHTML = '';
    $('mainEmpty').classList.toggle('hidden', liste.length > 0);
    $('mainEmpty').innerHTML = esc(kaynakHata || 'Personel programında puantajda görünecek personel yok.') +
      (isNative ? '' : '<br><a href="../Personel/">Personel programını aç</a>');
    liste.forEach(function (p) {
      if (!taslak[p.id]) taslak[p.id] = gunluk.durumlar[p.id] || VARSAYILAN;
      var d = taslak[p.id];
      var yeni = gunluk.gonderildi && gunluk.kayitliIdler.indexOf(p.id) < 0;
      var tr = document.createElement('tr');
      var opts = DURUMLAR.map(function (x) { return '<option' + (x === d ? ' selected' : '') + '>' + x + '</option>'; }).join('');
      tr.innerHTML = '<td><div class="namecell"><span class="dot ' + RENK[d] + '"></span><span class="fit">' + esc(p.ad) +
        (yeni ? '<span class="newtag">(yeni eklendi)</span>' : '') + '</span></div></td>' +
        '<td><select' + (d === SECINIZ ? ' class="secilmedi"' : '') + '>' + opts + '</select></td>';
      var sel = tr.querySelector('select'), dot = tr.querySelector('.dot');
      sel.addEventListener('change', function () {
        taslak[p.id] = sel.value; dot.className = 'dot ' + RENK[sel.value];
        sel.classList.toggle('secilmedi', sel.value === SECINIZ);
      });
      tb.appendChild(tr);
    });
    sigdir($('mainBody'));
  }

  /* İsimleri sahaya sığdır: taşarsa yazı boyutunu küçült */
  function sigdir(kok) {
    requestAnimationFrame(function () {
      (kok || document).querySelectorAll('.fit').forEach(function (el) {
        el.style.fontSize = '';
        var fs = parseFloat(getComputedStyle(el).fontSize) || 16;
        while (fs > 9 && el.scrollWidth > el.clientWidth + 0.5) { fs -= 0.5; el.style.fontSize = fs + 'px'; }
      });
    });
  }
  var sigT;
  window.addEventListener('resize', function () { clearTimeout(sigT); sigT = setTimeout(function () { sigdir(); }, 150); });

  function raporListesi() {
    // Seçiniz kalanlar rapora Bilinmiyor olarak yansır; kayıtlı veri Seçiniz olarak kalır
    return aktifPersonel().map(function (p) {
      var d = taslak[p.id] || VARSAYILAN;
      return { ad: p.ad, durum: d === SECINIZ ? 'BİLİNMİYOR' : d };
    })
      .sort(function (a, b) { return (SIRA[a.durum] - SIRA[b.durum]) || adSirala(a, b); });
  }

  var gonderiliyor = false;
  function gonder() {
    if (gonderiliyor) return;
    gunKontrol();
    if (!aktifPersonel().length) { toast('Önce aktif personel tanımlayınız.'); return; }
    var secilmemis = aktifPersonel().filter(function (p) { return (taslak[p.id] || VARSAYILAN) === SECINIZ; });
    if (secilmemis.length) {
      onay('Gönderim Onayı', 'Durumunu seçmediğiniz personeller mevcut,<br>Bu personeller için <b>Bilinmiyor</b> bilgisi ile raporu göndermek istiyor musunuz?',
        function () {
          // seçilmeyenler raporda Bilinmiyor görünür (raporListesi), ekranda ve kayıtta Seçiniz kalır
          gonderAsil();
        }, true);
      return;
    }
    gonderAsil();
  }
  function gonderAsil() {
    gonderiliyor = true;
    var zaman = new Date();
    var aciklama = $('txtAciklama').value.trim();
    var kayitlar = raporListesi();

    var durumlar = {};
    aktifPersonel().forEach(function (p) { durumlar[p.id] = taslak[p.id] || VARSAYILAN; });
    gunluk = { tarih: aktifGun, gonderildi: true, zaman: zaman.toISOString(), durumlar: durumlar, aciklama: aciklama,
      kayitliIdler: aktifPersonel().map(function (p) { return p.id; }) };
    yaz(K_GUNLUK, gunluk);
    arsiv.push({ id: uid(), zaman: zaman.toISOString(), kayitlar: kayitlar, aciklama: aciklama });
    kaydetArsiv();
    renderMain();

    var dataUrl = jpegOlustur(zaman, kayitlar, aciklama);
    var ad = 'puantaj_' + gunAnahtar(zaman) + '_' + pad(zaman.getHours()) + pad(zaman.getMinutes()) + '.jpg';
    paylas(dataUrl, ad).catch(function (e) { console.error(e); toast('Paylaşım yapılamadı.'); })
      .then(function () { gonderiliyor = false; });
  }

  /* ---------- JPEG oluşturma ---------- */
  function jpegOlustur(zaman, kayitlar, aciklama) {
    var W = 1080, P = 40, HDR = 150, TH = 64, RH = 72, FONT = 'Segoe UI, Roboto, Arial, sans-serif';
    var c = document.createElement('canvas'), x = c.getContext('2d');
    // açıklama satırlarını ölç
    var pre = 'Açıklama : ';
    x.font = 'bold 32px ' + FONT; var preW = x.measureText(pre).width;
    x.font = 'bold 32px ' + FONT;
    var satirlar = metinBol(x, aciklama || '', W - 2 * P, preW);
    var AH = 40 + satirlar.length * 44 + 30;
    c.width = W; c.height = HDR + TH + kayitlar.length * RH + AH;
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height);

    // üst panel
    x.fillStyle = '#1f4e79'; x.fillRect(0, 0, W, HDR);
    x.fillStyle = '#fff'; x.textBaseline = 'middle';
    x.font = 'bold 44px ' + FONT; x.fillText('PERSONEL DURUM RAPORU', P, 50);
    x.font = 'bold 32px ' + FONT;
    x.fillText('Tarih: ' + tarihYaz(zaman) + ' ' + GUNLER[zaman.getDay()] + ' / Rapor Saati: ' + saatYaz(zaman), P, 108);

    // tablo başlığı
    var y = HDR, cNo = P, cAd = P + 70, cDur = 760, R = 22, cIsim = cAd + 2 * R + 16;
    x.fillStyle = '#dfe7ef'; x.fillRect(0, y, W, TH);
    x.fillStyle = '#33404e'; x.font = 'bold 28px ' + FONT;
    x.fillText('#', cNo, y + TH / 2); x.fillText('Adı Soyadı', cAd, y + TH / 2); x.fillText('Durumu', cDur, y + TH / 2);
    y += TH;
    kayitlar.forEach(function (k, i) {
      x.fillStyle = i % 2 ? '#f6f9fc' : '#fff'; x.fillRect(0, y, W, RH);
      x.strokeStyle = '#d5dde6'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, y + RH); x.lineTo(W, y + RH); x.stroke();
      var my = y + RH / 2;
      x.fillStyle = '#6b7785'; x.font = '28px ' + FONT; x.fillText(String(i + 1), cNo, my);
      // renkli simge ismin önünde, isim bold ve sahaya sığacak kadar küçültülür
      top3d(x, cAd + R, my, R, k.durum);
      x.fillStyle = '#1b2430';
      var genis = cDur - cIsim - 20, fs = 32;
      x.font = 'bold ' + fs + 'px ' + FONT;
      while (fs > 18 && x.measureText(k.ad).width > genis) { fs--; x.font = 'bold ' + fs + 'px ' + FONT; }
      x.fillText(kisalt(x, k.ad, genis), cIsim, my);
      x.font = 'bold 30px ' + FONT; x.fillText(k.durum, cDur, my);
      y += RH;
    });

    // açıklama
    y += 40;
    satirlar.forEach(function (s, i) {
      var sx = P;
      if (i === 0) { x.fillStyle = '#000'; x.font = 'bold 32px ' + FONT; x.fillText(pre, P, y); sx = P + preW; }
      x.fillStyle = '#d00000'; x.font = 'bold 32px ' + FONT; x.fillText(s, sx, y);
      y += 44;
    });
    return c.toDataURL('image/jpeg', 0.92);
  }

  function kisalt(x, s, w) {
    if (x.measureText(s).width <= w) return s;
    while (s.length && x.measureText(s + '…').width > w) s = s.slice(0, -1);
    return s + '…';
  }

  function metinBol(x, metin, w, ilkGirinti) {
    var sonuc = [], paragraflar = metin.split(/\r?\n/);
    paragraflar.forEach(function (par) {
      var kelimeler = par.split(/\s+/).filter(Boolean), satir = '';
      if (!kelimeler.length) { sonuc.push(''); return; }
      kelimeler.forEach(function (k) {
        var genis = w - (sonuc.length === 0 ? ilkGirinti : 0);
        var dene = satir ? satir + ' ' + k : k;
        if (x.measureText(dene).width <= genis) { satir = dene; return; }
        if (satir) { sonuc.push(satir); genis = w - (sonuc.length === 0 ? ilkGirinti : 0); }
        // çok uzun kelimeyi böl
        while (x.measureText(k).width > genis) {
          var n = k.length; while (n > 1 && x.measureText(k.slice(0, n)).width > genis) n--;
          sonuc.push(k.slice(0, n)); k = k.slice(n); genis = w;
        }
        satir = k;
      });
      sonuc.push(satir);
    });
    return sonuc.length ? sonuc : [''];
  }

  function top3d(x, cx, cy, r, durum) {
    var renk = { 'GELMEDİ': ['#ffb3b3', '#ff3b3b', '#c40000', '#7a0000'], 'GELDİ': ['#c8ffc8', '#2ecc40', '#138a1f', '#0a4f10'],
      'BİLİNMİYOR': ['#ffffff', '#b5b5b5', '#7d7d7d', '#444444'] }[durum];
    x.save();
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
    var g = x.createRadialGradient(cx - r * 0.36, cy - r * 0.44, r * 0.05, cx, cy, r);
    g.addColorStop(0, renk[0]); g.addColorStop(0.3, renk[1]); g.addColorStop(0.7, renk[2]); g.addColorStop(1, renk[3]);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.restore();
    // parlama
    var h = x.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r * 0.5);
    h.addColorStop(0, 'rgba(255,255,255,.75)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = h; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }

  /* ---------- Paylaşım ---------- */
  function paylas(dataUrl, dosyaAdi, baslik, indirMesaji) {
    baslik = baslik || 'Personel Durum Raporu';
    var Fs = plug('Filesystem'), Sh = plug('Share');
    if (isNative && Fs && Sh) {
      return Fs.writeFile({ path: dosyaAdi, data: dataUrl.split(',')[1], directory: 'CACHE' })
        .then(function (r) { return Sh.share({ title: baslik, files: [r.uri], dialogTitle: baslik }); })
        .catch(function (e) { if (!/cancel/i.test(String(e && e.message))) throw e; });
    }
    return fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
      var file = new File([blob], dosyaAdi, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: baslik })
          .catch(function (e) { if (e && e.name !== 'AbortError') indir(dataUrl, dosyaAdi); });
      }
      indir(dataUrl, dosyaAdi);
      toast(indirMesaji || 'Rapor kaydedildi ve indirildi.');
    });
  }

  /* ---------- Satır etkileşimi: uzun basma + çift dokunma ---------- */
  function satirEtkilesim(tr, onLong, onDouble) {
    var timer = null, sx = 0, sy = 0, uzun = false, sonTik = 0;
    tr.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      uzun = false; sx = e.clientX; sy = e.clientY;
      clearTimeout(timer);
      timer = setTimeout(function () { uzun = true; satirSec(tr); onLong(tr, sx, sy); if (navigator.vibrate) navigator.vibrate(30); }, 550);
    });
    tr.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) clearTimeout(timer); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { tr.addEventListener(ev, function () { clearTimeout(timer); }); });
    tr.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    tr.addEventListener('click', function () {
      if (uzun) { uzun = false; return; }
      satirSec(tr);
      var t = Date.now();
      if (t - sonTik < 400) { sonTik = 0; onDouble(tr); } else sonTik = t;
    });
  }
  function satirSec(tr) {
    tr.parentNode.querySelectorAll('.selected').forEach(function (r) { r.classList.remove('selected'); });
    tr.classList.add('selected');
  }

  var menuSil = null, menuEk = null;
  // ek: { yazi, fn } verilirse menüde 2. sırada gösterilir
  function menuAc(x, y, silFn, ek) {
    var m = $('popMenu'); menuSil = silFn; menuEk = ek ? ek.fn : null;
    $('popEk').textContent = ek ? ek.yazi : '';
    $('popEk').classList.toggle('hidden', !ek);
    m.classList.remove('hidden');
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
    $('overlay').classList.remove('hidden'); $('overlay').style.background = 'transparent';
  }
  function menuKapat() {
    $('popMenu').classList.add('hidden'); menuSil = null; menuEk = null;
    if (!acikDialog()) { $('overlay').classList.add('hidden'); }
    $('overlay').style.background = '';
  }
  $('popVazgec').addEventListener('click', menuKapat);
  $('popSil').addEventListener('click', function () { var f = menuSil; menuKapat(); if (f) f(); });
  $('popEk').addEventListener('click', function () { var f = menuEk; menuKapat(); if (f) f(); });

  /* ---------- Pencereler ---------- */
  function acikDialog() { return document.querySelector('.dialog:not(.hidden)'); }
  function dialogAc(id) { $('overlay').classList.remove('hidden'); $('overlay').style.background = ''; $(id).classList.remove('hidden'); }
  function dialogKapat(id) {
    $(id).classList.add('hidden');
    if (!acikDialog() && $('popMenu').classList.contains('hidden')) $('overlay').classList.add('hidden');
  }
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { dialogKapat(b.closest('.dialog').id); });
  });
  $('overlay').addEventListener('click', function () {
    if (!$('popMenu').classList.contains('hidden')) { menuKapat(); return; }
  });

  var onayCb = null;
  function onay(baslik, mesaj, cb, html) {
    $('onayTitle').textContent = baslik; $('onayMsg')[html ? 'innerHTML' : 'textContent'] = mesaj; onayCb = cb;
    dialogAc('dlgOnay');
  }
  $('onayEvet').addEventListener('click', function () { var f = onayCb; onayCb = null; dialogKapat('dlgOnay'); if (f) f(); });
  $('onayHayir').addEventListener('click', function () { onayCb = null; dialogKapat('dlgOnay'); });

  /* ---------- ARŞİV ---------- */
  var DURUM_BASLIK = { 'GELMEDİ': 'Gelmedi', 'GELDİ': 'Geldi', 'BİLİNMİYOR': 'Bilinmiyor' };
  function durumHtml(a) {
    return a.kayitlar.map(function (k) { return esc(k.ad) + '(<b>' + (DURUM_BASLIK[k.durum] || esc(k.durum)) + '</b>)'; }).join(', ');
  }
  function renderArsiv() {
    var liste = arsiv.slice().sort(function (a, b) { return a.zaman < b.zaman ? 1 : a.zaman > b.zaman ? -1 : 0; });
    var tablo = $('arsivTable');
    tablo.querySelectorAll('tbody').forEach(function (b) { b.remove(); });
    $('arsivEmpty').classList.toggle('hidden', liste.length > 0);
    liste.forEach(function (a) {
      var d = new Date(a.zaman);
      // her kayıt kendi tbody'si: üst satır zaman + durum, alt satır açıklama
      var tr = document.createElement('tbody');
      tr.className = 'kayit';
      tr.innerHTML = '<tr><td><div class="clamp8"><b>' + tarihYaz(d) + ' ' + saatYaz(d) + '</b></div></td>' +
        '<td><div class="clamp8">' + durumHtml(a) + '</div></td></tr>' +
        (a.aciklama ? '<tr class="aciklama"><td colspan="2"><div class="clamp8">' + esc(a.aciklama) + '</div></td></tr>' : '');
      satirEtkilesim(tr, function (r, x, y) {
        menuAc(x, y, function () {
          onay('Kayıt Sil', tarihYaz(d) + ' ' + saatYaz(d) + ' tarihli arşiv kaydı silinsin mi?', function () {
            arsiv = arsiv.filter(function (q) { return q.id !== a.id; }); kaydetArsiv(); renderArsiv(); toast('Kayıt silindi.');
          });
        });
      }, function () {
        $('durumGosterBody').innerHTML = a.kayitlar.map(function (k) {
          return '<tr><td><div class="namecell"><span class="dot ' + RENK[k.durum] + '"></span><span class="fit">' + esc(k.ad) +
            '</span></div></td><td class="durumtxt">' + esc(k.durum) + '</td></tr>';
        }).join('');
        $('txtDurumAciklama').textContent = a.aciklama || '';
        $('txtDurumAciklama').scrollTop = 0;
        dialogAc('dlgDurum');
        sigdir($('durumGosterBody'));
      });
      tablo.appendChild(tr);
    });
    ilkSec(tablo);
  }
  function ilkSec(kok) { var ilk = kok.querySelector('tbody.kayit, tbody > tr'); if (ilk) satirSec(ilk); }

  $('btnArsivTumSil').addEventListener('click', function () {
    if (!arsiv.length) { toast('Silinecek kayıt yok.'); return; }
    onay('Tümünü Sil', 'Tüm arşiv kayıtları (' + arsiv.length + ' adet) silinsin mi?', function () {
      arsiv = []; kaydetArsiv(); renderArsiv(); toast('Tüm arşiv silindi.');
    });
  });
  $('btnArsivKapat').addEventListener('click', function () { ekranGoster('scrMain'); });

  /* ---------- Ana ekran düğmeleri ---------- */
  $('btnArsiv').addEventListener('click', function () { ekranGoster('scrArsiv'); });
  $('btnGonder').addEventListener('click', gonder);
  $('txtAciklama').addEventListener('input', function () { taslakAciklama = $('txtAciklama').value; });

  /* ---------- Android geri tuşu / çıkış onayı ---------- */
  var App = plug('App');
  if (isNative && App) {
    App.addListener('backButton', function () {
      if (!$('popMenu').classList.contains('hidden')) { menuKapat(); return; }
      var d = acikDialog();
      if (d) { if (d.id === 'dlgOnay') onayCb = null; dialogKapat(d.id); return; }
      if (aktifEkran !== 'scrMain') { ekranGoster('scrMain'); return; }
      onay('Çıkış', 'Uygulamadan çıkılsın mı?', function () { App.exitApp(); });
    });
  }

  /* ---------- Gün dönümü takibi ---------- */
  setInterval(gunKontrol, 20000);
  // uygulamaya dönülünce (ör. Personel programından) liste yenilenir
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { gunKontrol(); personelYenile(); } });
  window.addEventListener('focus', gunKontrol);

  // diğer sekmede/pencerede yapılan değişiklikleri al
  window.addEventListener('storage', function (e) {
    if (e.key === 'ps_personel') { personelYenile(); return; }
    arsiv = oku(K_ARSIV, []);
    ekranGoster(aktifEkran);
  });

  if ('serviceWorker' in navigator && !isNative && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  gunuYukle();
  ekranGoster('scrMain');
  personelYenile();
})();
