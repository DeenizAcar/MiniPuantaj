// CI'da `npx cap add android` sonrası çalışır: Personel uygulamasından personel listesini
// okuyan PersonelKaynak eklentisini Android projesine ekler.
const fs = require('fs');
const path = require('path');

const kok = path.join(__dirname, '..');
const javaDir = path.join(kok, 'android/app/src/main/java/com/deenizacar/minipuantaj2');
fs.copyFileSync(path.join(kok, 'android-ek/PersonelKaynakPlugin.java'), path.join(javaDir, 'PersonelKaynakPlugin.java'));

// MainActivity: eklentiyi kaydet
const ma = path.join(javaDir, 'MainActivity.java');
let j = fs.readFileSync(ma, 'utf8');
if (!j.includes('PersonelKaynakPlugin')) {
  j = j.replace(/public class MainActivity extends BridgeActivity\s*\{\s*\}/, `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(PersonelKaynakPlugin.class);
        super.onCreate(savedInstanceState);
    }
}`);
  if (!j.includes('registerPlugin(PersonelKaynakPlugin.class)')) throw new Error('MainActivity güncellenemedi:\n' + j);
  fs.writeFileSync(ma, j);
}

// Manifest: Android 11+ paket görünürlüğü için Personel uygulamasını bildir
const mf = path.join(kok, 'android/app/src/main/AndroidManifest.xml');
let s = fs.readFileSync(mf, 'utf8');
if (!s.includes('com.deenizacar.personel')) {
  s = s.replace('<application', `<queries>
        <package android:name="com.deenizacar.personel" />
        <provider android:authorities="com.deenizacar.personel.puantaj" />
    </queries>

    <application`);
  if (!s.includes('com.deenizacar.personel')) throw new Error('Manifest güncellenemedi');
  fs.writeFileSync(mf, s);
}
console.log('PersonelKaynak eklendi');
