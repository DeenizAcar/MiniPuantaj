package com.deenizacar.minipuantaj2;

import android.database.Cursor;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Personel uygulamasının PuantajProvider'ından personel listesini okur.
 * JS: Capacitor.Plugins.PersonelKaynak.oku() -> { json }
 * Hata kodları: YOK (Personel kurulu değil), IZIN (erişim reddedildi), HATA
 */
@CapacitorPlugin(name = "PersonelKaynak")
public class PersonelKaynakPlugin extends Plugin {

    private static final Uri URI = Uri.parse("content://com.deenizacar.personel.puantaj/personel");

    @PluginMethod
    public void oku(PluginCall call) {
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(URI, null, null, null, null);
            if (c == null) { call.reject("Personel uygulaması bulunamadı", "YOK"); return; }
            String json = c.moveToFirst() ? c.getString(0) : null;
            JSObject r = new JSObject();
            r.put("json", json);
            call.resolve(r);
        } catch (SecurityException e) {
            call.reject("Personel verisine erişim izni yok", "IZIN", e);
        } catch (Exception e) {
            call.reject("Personel verisi okunamadı", "HATA", e);
        } finally {
            if (c != null) c.close();
        }
    }
}
