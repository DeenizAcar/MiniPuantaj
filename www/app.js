/* Mini Puantaj - tek dosyalık uygulama mantığı */
(function () {
  'use strict';

  var DURUMLAR = ['GELMEDİ', 'GELDİ', 'BİLİNMİYOR'];
  var VARSAYILAN = 'GELMEDİ';
  var SIRA = { 'GELMEDİ': 0, 'BİLİNMİYOR': 1, 'GELDİ': 2 };
  var RENK = { 'GELMEDİ': 'red', 'GELDİ': 'green', 'BİLİNMİYOR': 'gray' };
  var GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  // yüzsüz porte simgeleri
  var IKON = {
    'Erkek': '<svg class="gicon" viewBox="0 0 24 24" aria-label="Erkek"><circle cx="12" cy="7.5" r="4.5" fill="#1f6fb5"/><path d="M3.5 22c0-5 3.8-8.5 8.5-8.5s8.5 3.5 8.5 8.5z" fill="#1f6fb5"/></svg>',
    'Kadın': '<svg class="gicon" viewBox="0 0 24 24" aria-label="Kadın"><path d="M12 2.2c-3.4 0-5.6 2.6-5.6 6 0 2.2-.6 4-1.6 5.3 1.6.6 3.3.8 4.6.7a5 5 0 0 0 5.2 0c1.3.1 3-.1 4.6-.7-1-1.3-1.6-3.1-1.6-5.3 0-3.4-2.2-6-5.6-6z" fill="#c2185b"/><path d="M12 15c-3.5 0-6.2 2.4-7.5 7h15c-1.3-4.6-4-7-7.5-7z" fill="#c2185b"/></svg>'
  };

  var K_PERSONEL = 'mp_personel', K_GUNLUK = 'mp_gunluk', K_ARSIV = 'mp_arsiv';

  var $ = function (id) { return document.getElementById(id); };
  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var plug = function (n) { return Cap && Cap.Plugins ? Cap.Plugins[n] : null; };

  /* ---------- Depolama ---------- */
  function oku(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Kayıt yapılamadı!'); } }

  var personel = oku(K_PERSONEL, []);  // [{id, ad, cinsiyet}]
  var arsiv = oku(K_ARSIV, []);        // [{id, zaman, kayitlar:[{ad,durum}], aciklama}]
  function aktifPersonel() { return personel.filter(function (p) { return !p.pasif; }); }
  function kaydetPersonel() { yaz(K_PERSONEL, personel); }
  function kaydetArsiv() { yaz(K_ARSIV, arsiv); }
  var K_SILINEN = 'mp_silinen';
  var silinen = oku(K_SILINEN, []);    // [{id, zaman, ad, pasif}]
  function kaydetSilinen() { yaz(K_SILINEN, silinen); }

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
    if (id === 'scrTanim') renderTanim();
    if (id === 'scrArsiv') renderArsiv();
    if (id === 'scrSilinen') renderSilinen();
  }

  /* ---------- ANA EKRAN ---------- */
  function renderMain() {
    var now = new Date();
    $('mainDate').textContent = tarihYaz(now) + ' ' + GUNLER[now.getDay()];
    $('mainSent').textContent = gunluk.gonderildi ? ('Rapor gönderildi : ' + saatYaz(new Date(gunluk.zaman))) : '';

    var liste = aktifPersonel().sort(adSirala);
    var tb = $('mainBody'); tb.innerHTML = '';
    $('mainEmpty').classList.toggle('hidden', liste.length > 0);
    liste.forEach(function (p) {
      if (!taslak[p.id]) taslak[p.id] = VARSAYILAN;
      var d = taslak[p.id];
      var yeni = gunluk.gonderildi && gunluk.kayitliIdler.indexOf(p.id) < 0;
      var tr = document.createElement('tr');
      var opts = DURUMLAR.map(function (x) { return '<option' + (x === d ? ' selected' : '') + '>' + x + '</option>'; }).join('');
      tr.innerHTML = '<td><div class="namecell"><span class="dot ' + RENK[d] + '"></span><span class="fit">' + esc(p.ad) +
        (yeni ? '<span class="newtag">(yeni eklendi)</span>' : '') + '</span></div></td>' +
        '<td><select>' + opts + '</select></td>';
      var sel = tr.querySelector('select'), dot = tr.querySelector('.dot');
      sel.addEventListener('change', function () { taslak[p.id] = sel.value; dot.className = 'dot ' + RENK[sel.value]; });
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
    return aktifPersonel().map(function (p) { return { ad: p.ad, durum: taslak[p.id] || VARSAYILAN }; })
      .sort(function (a, b) { return (SIRA[a.durum] - SIRA[b.durum]) || adSirala(a, b); });
  }

  var gonderiliyor = false;
  function gonder() {
    if (gonderiliyor) return;
    gunKontrol();
    if (!aktifPersonel().length) { toast('Önce aktif personel tanımlayınız.'); return; }
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

  /* ---------- Excel Dışa Aktar / İçe Aktar ---------- */
  var xlsxSoz = null;
  function xlsxYukle() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxSoz) xlsxSoz = new Promise(function (ok, hata) {
      var s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js';
      s.onload = function () { ok(window.XLSX); };
      s.onerror = function () { xlsxSoz = null; hata(new Error('xlsx yüklenemedi')); };
      document.head.appendChild(s);
    });
    return xlsxSoz;
  }
  var DURUM_GERI = { 'gelmedi': 'GELMEDİ', 'geldi': 'GELDİ', 'bilinmiyor': 'BİLİNMİYOR' };
  var CINS_GERI = { 'erkek': 'Erkek', 'kadın': 'Kadın', 'kadin': 'Kadın', 'bilinmiyor': 'Bilinmiyor' };

  function disaAktar() {
    xlsxYukle().then(function (X) {
      var pRows = personel.slice().sort(adSirala).map(function (p) {
        return { 'Adı Soyadı': p.ad, 'Cinsiyeti': p.cinsiyet, 'Durumu': p.pasif ? 'Pasif' : 'Aktif' };
      });
      var aRows = arsiv.slice().sort(function (a, b) { return a.zaman < b.zaman ? 1 : -1; }).map(function (a) {
        var d = new Date(a.zaman);
        return { 'Gönderme Zamanı': tarihYaz(d) + ' ' + saatYaz(d),
          'Personel Durumu': a.kayitlar.map(function (k) { return k.ad + ' - ' + (DURUM_BASLIK[k.durum] || k.durum); }).join(', '),
          'Açıklama': a.aciklama || '', 'Kayıt No': a.id };
      });
      var wb = X.utils.book_new();
      var ws1 = X.utils.json_to_sheet(pRows, { header: ['Adı Soyadı', 'Cinsiyeti', 'Durumu'] });
      ws1['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 10 }];
      var ws2 = X.utils.json_to_sheet(aRows, { header: ['Gönderme Zamanı', 'Personel Durumu', 'Açıklama', 'Kayıt No'] });
      ws2['!cols'] = [{ wch: 18 }, { wch: 90 }, { wch: 40 }, { wch: 14 }];
      X.utils.book_append_sheet(wb, ws1, 'Personel');
      X.utils.book_append_sheet(wb, ws2, 'Arşiv');
      var b64 = X.write(wb, { bookType: 'xlsx', type: 'base64' });
      var mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      return paylas('data:' + mime + ';base64,' + b64, 'minipuantaj_' + gunAnahtar() + '.xlsx', 'Mini Puantaj Excel', 'Excel dosyası indirildi.');
    }).catch(function (e) { console.error(e); toast('Dışa aktarılamadı.'); });
  }

  function hucre(row, adlar) {
    for (var i = 0; i < adlar.length; i++) {
      for (var k in row) if (trKucuk(k).replace(/\s+/g, ' ').trim() === adlar[i]) return row[k];
    }
    return undefined;
  }
  function zamanCoz(v) {
    if (v instanceof Date) return v;
    var m = String(v || '').trim().match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  }
  function durumCoz(metin) {
    return String(metin || '').split(/\s*,\s*/).map(function (parca) {
      var i = parca.lastIndexOf(' - '); if (i < 0) return null;
      var ad = parca.slice(0, i).trim(), d = DURUM_GERI[trKucuk(parca.slice(i + 3).trim())];
      return ad && d ? { ad: ad, durum: d } : null;
    }).filter(Boolean);
  }

  function iceAktar(dosya) {
    Promise.all([xlsxYukle(), dosya.arrayBuffer()]).then(function (r) {
      var X = r[0], wb = X.read(r[1], { type: 'array', cellDates: true });
      var sPers = wb.Sheets['Personel'] || wb.Sheets[wb.SheetNames[0]];
      var sArs = wb.Sheets['Arşiv'];
      var yeniP = [], yeniA = [];
      var ayniAd = function (liste, ad) { return liste.some(function (q) { return trKucuk(q.ad) === trKucuk(ad); }); };
      if (sPers) X.utils.sheet_to_json(sPers, { defval: '' }).forEach(function (row) {
        var ad = String(hucre(row, ['adı soyadı', 'adi soyadi', 'ad soyad', 'isim soyisim', 'isim']) || row[Object.keys(row)[0]] || '').replace(/\s+/g, ' ').trim();
        if (!ad || ayniAd(personel, ad) || ayniAd(yeniP, ad)) return;
        var cins = CINS_GERI[trKucuk(String(hucre(row, ['cinsiyeti', 'cinsiyet']) || '').trim())] || 'Bilinmiyor';
        var pasif = trKucuk(String(hucre(row, ['durumu', 'durum']) || '')).trim() === 'pasif';
        yeniP.push({ id: uid(), ad: ad, cinsiyet: cins, pasif: pasif });
      });
      if (sArs) X.utils.sheet_to_json(sArs, { defval: '' }).forEach(function (row) {
        var z = zamanCoz(hucre(row, ['gönderme zamanı'])); if (!z || isNaN(z)) return;
        var kay = durumCoz(hucre(row, ['personel durumu'])); if (!kay.length) return;
        var id = String(hucre(row, ['kayıt no']) || '').trim() || ('x' + z.getTime().toString(36));
        if (arsiv.some(function (q) { return q.id === id; }) || yeniA.some(function (q) { return q.id === id; })) return;
        kay.sort(function (a, b) { return (SIRA[a.durum] - SIRA[b.durum]) || adSirala(a, b); });
        yeniA.push({ id: id, zaman: z.toISOString(), kayitlar: kay, aciklama: String(hucre(row, ['açıklama']) || '') });
      });
      if (!yeniP.length && !yeniA.length) { toast('Dosyada eklenecek yeni kayıt bulunamadı.'); return; }
      onay('İçe Aktar', yeniP.length + ' yeni personel ve ' + yeniA.length +
        ' yeni arşiv kaydı eklensin mi? (Var olan kayıtlar silinmez)', function () {
        yeniP.forEach(function (p) { personel.push(p); taslak[p.id] = VARSAYILAN; });
        yeniA.forEach(function (a) { arsiv.push(a); });
        kaydetPersonel(); kaydetArsiv(); renderTanim();
        toast(yeniP.length + ' personel, ' + yeniA.length + ' arşiv kaydı eklendi.');
      });
    }).catch(function (e) { console.error(e); toast('Dosya okunamadı. Excel (.xlsx) dosyası seçiniz.'); });
  }
  function indir(dataUrl, ad) { var a = document.createElement('a'); a.href = dataUrl; a.download = ad; document.body.appendChild(a); a.click(); a.remove(); }

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
  function onay(baslik, mesaj, cb) {
    $('onayTitle').textContent = baslik; $('onayMsg').textContent = mesaj; onayCb = cb;
    dialogAc('dlgOnay');
  }
  $('onayEvet').addEventListener('click', function () { var f = onayCb; onayCb = null; dialogKapat('dlgOnay'); if (f) f(); });
  $('onayHayir').addEventListener('click', function () { onayCb = null; dialogKapat('dlgOnay'); });

  /* ---------- TANIMLAR ---------- */
  var araKelimeler = [];
  function aramaKelimeleri() {
    return araKelimeler.concat($('txtAra').value.split(/\s+/).filter(Boolean)).map(trKucuk);
  }
  function renderChips() {
    var box = $('araEtiketler'); box.innerHTML = '';
    araKelimeler.forEach(function (k, i) {
      var c = document.createElement('span'); c.className = 'chip';
      c.innerHTML = '<span>' + esc(k) + '</span><button class="xbtn" title="Kelimeyi sil">✕</button>';
      c.querySelector('button').addEventListener('click', function (e) {
        e.stopPropagation(); araKelimeler.splice(i, 1); renderTanim();
      });
      box.appendChild(c);
    });
    $('txtAra').placeholder = araKelimeler.length ? '' : 'İsim soyisim ara...';
  }
  function araGirdi() {
    var v = $('txtAra').value;
    if (/\s/.test(v)) {
      var parca = v.split(/\s+/), son = parca.pop();
      parca.filter(Boolean).forEach(function (k) { araKelimeler.push(k); });
      $('txtAra').value = son;
    }
    renderTanim();
  }

  function renderTanim() {
    renderChips();
    var kel = aramaKelimeleri();
    var liste = personel.slice().sort(adSirala).filter(function (p) {
      if (!kel.length) return true;
      var ad = trKucuk(p.ad);
      return kel.some(function (k) { return ad.indexOf(k) >= 0; });
    });
    var tb = $('tanimBody'); tb.innerHTML = '';
    var bos = $('tanimEmpty');
    bos.classList.toggle('hidden', liste.length > 0);
    bos.innerHTML = personel.length ? 'Aramaya uyan personel bulunamadı.' : 'Henüz personel yok.<br>“Personel Ekle” ile ekleyebilirsiniz.';
    liste.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><span class="fit"><span class="pname' + (p.pasif ? ' pasif' : '') + '">' + esc(p.ad) + '</span>' +
        (p.pasif ? '<span class="pasiftag">(PASİF)</span>' : '') + '</span></td>' +
        '<td><span class="cins">' + esc(p.cinsiyet) + (IKON[p.cinsiyet] || '') + '</span></td>';
      satirEtkilesim(tr, function (r, x, y) {
        menuAc(x, y, function () {
          onay('Personel Sil', '“' + p.ad + '” silinsin mi?', function () {
            personel = personel.filter(function (q) { return q.id !== p.id; });
            delete taslak[p.id];
            silinen.push({ id: uid(), zaman: new Date().toISOString(), ad: p.ad, pasif: !!p.pasif });
            kaydetPersonel(); kaydetSilinen(); renderTanim(); toast('Personel silindi ve arşive alındı.');
          });
        }, {
          yazi: p.pasif ? 'Aktif Yap' : 'Pasif Yap',
          fn: function () {
            p.pasif = !p.pasif;
            if (!p.pasif && !taslak[p.id]) taslak[p.id] = VARSAYILAN;
            kaydetPersonel(); renderTanim();
            toast('“' + p.ad + '” ' + (p.pasif ? 'pasif yapıldı.' : 'aktif yapıldı.'));
          }
        });
      }, function () { personelDialog(p); });
      tb.appendChild(tr);
    });
    sigdir(tb);
  }

  var duzenlenen = null;
  function personelDialog(p) {
    duzenlenen = p || null;
    $('dlgPersonelTitle').textContent = p ? 'Personel Düzenle' : 'Personel Ekle';
    $('inpAd').value = p ? p.ad : '';
    $('inpCins').value = p ? p.cinsiyet : 'Bilinmiyor';
    $('inpPasif').checked = !!(p && p.pasif);
    $('dlgPersonelErr').textContent = '';
    dialogAc('dlgPersonel');
    setTimeout(function () { $('inpAd').focus(); }, 50);
  }
  function personelKaydet() {
    var ad = $('inpAd').value.replace(/\s+/g, ' ').trim();
    if (!ad) { $('dlgPersonelErr').textContent = 'Adı soyadı boş olamaz.'; return; }
    var ayni = personel.some(function (q) { return q !== duzenlenen && trKucuk(q.ad) === trKucuk(ad); });
    if (ayni) { $('dlgPersonelErr').textContent = 'Bu isimde bir personel zaten var.'; return; }
    var pasif = $('inpPasif').checked;
    if (duzenlenen) { duzenlenen.ad = ad; duzenlenen.cinsiyet = $('inpCins').value; duzenlenen.pasif = pasif; }
    else { var y = { id: uid(), ad: ad, cinsiyet: $('inpCins').value, pasif: pasif }; personel.push(y); taslak[y.id] = VARSAYILAN; }
    kaydetPersonel(); dialogKapat('dlgPersonel'); renderTanim();
  }
  $('btnPersonelKaydet').addEventListener('click', personelKaydet);
  $('inpAd').addEventListener('keydown', function (e) { if (e.key === 'Enter') personelKaydet(); });
  $('btnPersonelEkle').addEventListener('click', function () { personelDialog(null); });
  $('txtAra').addEventListener('input', araGirdi);
  $('txtAra').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && $('txtAra').value.trim()) { araKelimeler.push($('txtAra').value.trim()); $('txtAra').value = ''; renderTanim(); }
    else if (e.key === 'Backspace' && !$('txtAra').value && araKelimeler.length) { araKelimeler.pop(); renderTanim(); }
  });
  $('araKutu').addEventListener('click', function () { $('txtAra').focus(); });
  $('btnAraTemizle').addEventListener('click', function (e) { e.stopPropagation(); araKelimeler = []; $('txtAra').value = ''; renderTanim(); });
  $('btnSilinenArsiv').addEventListener('click', function () { ekranGoster('scrSilinen'); });
  $('btnTanimKapat').addEventListener('click', function () { ekranGoster('scrMain'); });
  $('btnDisaAktar').addEventListener('click', disaAktar);
  $('btnIceAktar').addEventListener('click', function () { $('inpIceAktar').value = ''; $('inpIceAktar').click(); });
  $('inpIceAktar').addEventListener('change', function () { if (this.files && this.files[0]) iceAktar(this.files[0]); });

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
        $('txtDurumAciklama').value = a.aciklama || '';
        dialogAc('dlgDurum');
        sigdir($('durumGosterBody'));
      });
      tablo.appendChild(tr);
    });
    ilkSec(tablo);
  }
  function ilkSec(kok) { var ilk = kok.querySelector('tbody.kayit, tbody > tr'); if (ilk) satirSec(ilk); }

  /* ---------- SİLİNEN PERSONEL ARŞİVİ ---------- */
  function renderSilinen() {
    var liste = silinen.slice().sort(function (a, b) { return a.zaman < b.zaman ? 1 : a.zaman > b.zaman ? -1 : 0; });
    var tb = $('silinenBody'); tb.innerHTML = '';
    $('silinenEmpty').classList.toggle('hidden', liste.length > 0);
    liste.forEach(function (k) {
      var d = new Date(k.zaman), z = tarihYaz(d) + ' ' + saatYaz(d);
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><b>' + z + '</b></td><td><span class="fit"><span class="pname">' + esc(k.ad) + '</span>' +
        '</span>' + (k.pasif ? '<span class="pasifken">(PASİFKEN)</span>' : '') + '</td>';
      satirEtkilesim(tr, function (r, x, y) {
        menuAc(x, y, function () {
          onay('Kayıt Sil', '“' + k.ad + '” silme kaydı arşivden silinsin mi?', function () {
            silinen = silinen.filter(function (q) { return q.id !== k.id; }); kaydetSilinen(); renderSilinen(); toast('Kayıt silindi.');
          });
        });
      }, function () {});
      tb.appendChild(tr);
    });
    ilkSec(tb.parentNode);
    sigdir(tb);
  }
  $('btnSilinenTumSil').addEventListener('click', function () {
    if (!silinen.length) { toast('Silinecek kayıt yok.'); return; }
    onay('Tümünü Sil', 'Tüm arşiv kayıtları (' + silinen.length + ' adet) silinsin mi?', function () {
      silinen = []; kaydetSilinen(); renderSilinen(); toast('Tüm arşiv silindi.');
    });
  });
  $('btnSilinenKapat').addEventListener('click', function () { ekranGoster('scrTanim'); });
  $('btnArsivTumSil').addEventListener('click', function () {
    if (!arsiv.length) { toast('Silinecek kayıt yok.'); return; }
    onay('Tümünü Sil', 'Tüm arşiv kayıtları (' + arsiv.length + ' adet) silinsin mi?', function () {
      arsiv = []; kaydetArsiv(); renderArsiv(); toast('Tüm arşiv silindi.');
    });
  });
  $('btnArsivKapat').addEventListener('click', function () { ekranGoster('scrMain'); });

  /* ---------- Ana ekran düğmeleri ---------- */
  $('btnTanimlar').addEventListener('click', function () { ekranGoster('scrTanim'); });
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
      if (aktifEkran === 'scrSilinen') { ekranGoster('scrTanim'); return; }
      if (aktifEkran !== 'scrMain') { ekranGoster('scrMain'); return; }
      onay('Çıkış', 'Uygulamadan çıkılsın mı?', function () { App.exitApp(); });
    });
  }

  /* ---------- Gün dönümü takibi ---------- */
  setInterval(gunKontrol, 20000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) gunKontrol(); });
  window.addEventListener('focus', gunKontrol);

  // diğer sekmede/pencerede yapılan değişiklikleri al
  window.addEventListener('storage', function () {
    personel = oku(K_PERSONEL, []); arsiv = oku(K_ARSIV, []); silinen = oku(K_SILINEN, []);
    ekranGoster(aktifEkran);
  });

  if ('serviceWorker' in navigator && !isNative && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  gunuYukle();
  ekranGoster('scrMain');
})();
