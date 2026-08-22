package com.rizvi.diagnosticcenter;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AndroidUpdate")
public class UpdatePlugin extends Plugin {
    private static final String REPO = "stalker-one/RizviDiagnostic";
    private static final String MANIFEST_URL = "https://raw.githubusercontent.com/stalker-one/RizviDiagnostic/main/update-manifest-android.json";
    private static final String PREFS = "rizvi_android_update";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod public void getVersion(PluginCall call){try{PackageInfo i=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);long c=Build.VERSION.SDK_INT>=Build.VERSION_CODES.P?i.getLongVersionCode():i.versionCode;JSObject r=new JSObject();r.put("versionCode",c);r.put("versionName",i.versionName==null?"":i.versionName);call.resolve(r);}catch(Exception e){call.reject("Unable to read installed Android app version: "+e.getMessage(),e);}}

    @PluginMethod public void checkForUpdate(PluginCall call){executor.execute(()->{try{PackageInfo installed=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);long installedCode=Build.VERSION.SDK_INT>=Build.VERSION_CODES.P?installed.getLongVersionCode():installed.versionCode;String pkg=installed.packageName;JSONObject release=fetchRelease(releaseTag(pkg));JSONObject apk=findBestApk(release.optJSONArray("assets"),apkName(pkg));JSObject r=new JSObject();r.put("available",false);r.put("installedVersionCode",installedCode);r.put("installedVersionName",installed.versionName==null?"":installed.versionName);r.put("packageName",pkg);r.put("tag",releaseTag(pkg));r.put("releaseName",release.optString("name",releaseTag(pkg)));String body=release.optString("body","");body=body.replace("\\r\\n","\n").replace("\\r","").replace("\\n","\n");r.put("releaseNotes",cleanReleaseNotes(body));if(apk==null){call.resolve(r);return;}long remote=extractNumber(body,"Version code\\s*:\\s*(\\d+)");if(remote<=0)remote=extractNumber(body,"Version\\s*(?:Code|Build)\\s*[:=]\\s*(\\d+)");if(remote<=0)remote=extractNumber(apk.optString("name",""),"(?:-|_)(\\d+)(?:-|_)[0-9a-f]{7,40}\\.apk$");if(remote<=0)remote=extractNumber(apk.optString("name",""),"(?:-|_)(\\d+)\\.apk$");if(remote<=0){call.resolve(r);return;}if(remote<=installedCode){call.resolve(r);return;}String vn=extractText(body,"Version name\\s*:\\s*([^\\r\\n]+)");r.put("available",true);r.put("versionCode",remote);r.put("versionName",vn.isEmpty()?"1.0."+remote:vn);r.put("url",apk.optString("browser_download_url",""));r.put("sha256",extractSha256(body));long size=apk.optLong("size",0);r.put("sizeBytes",size);r.put("sizeMB",Math.round((size/1024d/1024d)*10d)/10d);r.put("commit",extractText(body,"commit\\s+([0-9a-f]{7,40})"));call.resolve(r);}catch(Exception e){JSObject r=new JSObject();try{PackageInfo installed=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);r.put("installedVersionCode",Build.VERSION.SDK_INT>=Build.VERSION_CODES.P?installed.getLongVersionCode():installed.versionCode);r.put("installedVersionName",installed.versionName==null?"":installed.versionName);}catch(Exception ignored){}r.put("available",false);r.put("offline",true);call.resolve(r);}});}

    private String releaseTag(String p){return p.endsWith(".superadmin")?"android-superadmin-latest":"android-latest";}
    private String apkName(String p){return p.endsWith(".superadmin")?"RizviDiagnosticSuperadmin-latest.apk":"RizviDiagnosticCenter-latest.apk";}

    private JSONObject fetchRelease(String tag)throws Exception{
        String raw=null;Exception networkError=null;
        try{
            URL u=new URL(MANIFEST_URL+"?ts="+System.currentTimeMillis());
            HttpURLConnection c=(HttpURLConnection)u.openConnection();
            c.setConnectTimeout(1200);c.setReadTimeout(1800);c.setUseCaches(false);c.setRequestProperty("Cache-Control","no-cache");c.setRequestProperty("Pragma","no-cache");c.setRequestProperty("User-Agent","RizviDiagnosticCenter-Android-Updater/8");c.connect();
            int s=c.getResponseCode();if(s!=200)throw new IllegalStateException("Update manifest HTTP "+s);
            StringBuilder j=new StringBuilder();try(BufferedReader br=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8))){String line;while((line=br.readLine())!=null)j.append(line);}finally{c.disconnect();}
            raw=j.toString();getContext().getSharedPreferences(PREFS,0).edit().putString("manifest",raw).apply();
        }catch(Exception e){networkError=e;raw=getContext().getSharedPreferences(PREFS,0).getString("manifest",null);}
        if(raw==null||raw.trim().isEmpty())throw(networkError!=null?networkError:new IllegalStateException("Update manifest unavailable"));
        JSONObject root=new JSONObject(raw);String key=tag.equals("android-superadmin-latest")?"superadmin":"staff";JSONObject item=root.optJSONObject(key);if(item==null)throw new IllegalStateException("No update information for "+key);
        JSONObject release=new JSONObject();String version=item.optString("versionName","");release.put("name",version.isEmpty()?tag:version);release.put("body","## What's New\n- "+item.optString("releaseNotes","Latest update from the current release.")+"\n\n## Build information\nVersion code: "+item.optLong("versionCode",0)+"\nVersion name: "+version+"\nAPK SHA-256: "+item.optString("sha256","")+"\nAPK size: "+item.optLong("sizeBytes",0)+" bytes");JSONArray assets=new JSONArray();JSONObject asset=new JSONObject();asset.put("name",tag.equals("android-superadmin-latest")?"RizviDiagnosticSuperadmin-latest.apk":"RizviDiagnosticCenter-latest.apk");asset.put("browser_download_url",item.optString("apkUrl",""));asset.put("size",item.optLong("sizeBytes",0));assets.put(asset);release.put("assets",assets);return release;
    }

    private JSONObject findBestApk(JSONArray a,String expected){if(a==null)return null;JSONObject fallback=null;long newest=Long.MIN_VALUE;for(int i=0;i<a.length();i++){JSONObject x=a.optJSONObject(i);if(x==null)continue;String n=x.optString("name","");if(expected.equals(n))return x;if(!n.toLowerCase(Locale.US).endsWith(".apk"))continue;long t=0;try{String u=x.optString("updated_at","");if(!u.isEmpty())t=Instant.parse(u).toEpochMilli();}catch(Exception ignored){}if(fallback==null||t>newest){fallback=x;newest=t;}}return fallback;}
    private long extractNumber(String text,String regex){Matcher m=Pattern.compile(regex,Pattern.CASE_INSENSITIVE).matcher(text==null?"":text);return m.find()?Long.parseLong(m.group(1)):0L;}
    private String extractText(String text,String regex){Matcher m=Pattern.compile(regex,Pattern.CASE_INSENSITIVE).matcher(text==null?"":text);return m.find()?m.group(1).trim():"";}
    private String extractSha256(String body){return extractText(body,"APK SHA-256\\s*:\\s*([0-9a-f]{64})").toLowerCase(Locale.US);}

    private String cleanReleaseNotes(String body){String s=String.valueOf(body==null?"":body).replace("\\r","").replace("\\n","\n").trim();if(s.isEmpty())return "Latest update from the current release.";String[] lines=s.split("\\n");boolean inNotes=false;for(String raw:lines){String line=raw.trim();if(line.isEmpty())continue;if(line.matches("(?i)^#{1,6}\\s*(build information|technical information|release information|verification|assets|installation|download|checksums?)\\s*$"))break;if(line.matches("(?i)^#{1,6}\\s*(what'?s new|latest update|changes?|release notes?)\\s*$")){inNotes=true;continue;}if(line.matches("(?i)^(version code|version name|apk sha-256|apk size|commit|package|workflow|artifact|release[- ]signed|automatically rebuilt)\\s*[:=].*$"))continue;if(line.matches("^#{1,6}\\s*.*$"))continue;if(!inNotes&&!line.matches("^[-*•]\\s+.*$"))continue;line=line.replaceFirst("^[-*•]\\s+","").replaceFirst("^\\d+[.)]\\s+","").trim();if(line.isEmpty())continue;if(line.matches("(?i)^(version code|version name|apk sha-256|apk size|commit|package|workflow|artifact|download|build information).*$"))continue;return line;}return "Latest update from the current release.";}

    @PluginMethod public void installApk(PluginCall call){String url=call.getString("url","");if(url==null||url.trim().isEmpty()){call.reject("Update download URL is missing.");return;}if(!url.startsWith("https://")||!isAllowedUpdateUrl(url)){call.reject("Update source is not an approved Rizvi Diagnostic release URL.");return;}if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O&&!getContext().getPackageManager().canRequestPackageInstalls()){try{getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getContext().getPackageName())));call.reject("Please allow this app to install updates, then tap Update Now again.");}catch(Exception e){call.reject("Android installation permission is required: "+e.getMessage(),e);}return;}call.setKeepAlive(true);executor.execute(()->{File apk=new File(getContext().getCacheDir(),"rizvi-diagnostic-update.apk");try{JSONObject release=fetchRelease(releaseTag(getContext().getPackageName()));JSONObject asset=findBestApk(release.optJSONArray("assets"),apkName(getContext().getPackageName()));if(asset==null)throw new SecurityException("Approved update APK was not found in the latest release.");String approved=asset.optString("browser_download_url","");if(!url.equals(approved))throw new SecurityException("Update URL does not match the approved latest release asset.");String expected=extractSha256(release.optString("body",""));if(expected.isEmpty())throw new SecurityException("Latest release has no APK integrity hash.");if(apk.exists()&&!apk.delete())throw new IllegalStateException("Unable to clear the previous update file.");HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(120000);c.setInstanceFollowRedirects(true);c.setRequestProperty("User-Agent","RizviDiagnosticCenter-Android-Updater/8");c.connect();int response=c.getResponseCode();if(response<200||response>=300)throw new IllegalStateException("Update server returned HTTP "+response);long total=c.getContentLengthLong();try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(apk)){byte[] b=new byte[16384];long done=0;int n,last=-1;while((n=in.read(b))!=-1){out.write(b,0,n);done+=n;int pct=total>0?(int)Math.min(99,(done*100L)/total):-1;if(pct!=last){last=pct;JSObject p=new JSObject();p.put("percent",pct);p.put("downloadedBytes",done);p.put("totalBytes",total);notifyListeners("updateProgress",p);}}}finally{c.disconnect();}if(!apk.isFile()||apk.length()<10000)throw new IllegalStateException("Downloaded update APK is incomplete.");verifySha256(apk,expected);verifyDownloadedApk(apk);JSObject done=new JSObject();done.put("percent",100);done.put("downloadedBytes",apk.length());done.put("totalBytes",apk.length());notifyListeners("updateProgress",done);getActivity().runOnUiThread(()->{try{Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",apk);Intent i=new Intent(Intent.ACTION_VIEW);i.setDataAndType(uri,"application/vnd.android.package-archive");i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);getActivity().startActivity(i);call.resolve();}catch(Exception e){call.reject("Unable to start Android update installer: "+e.getMessage(),e);}finally{call.setKeepAlive(false);}});}catch(Exception e){getActivity().runOnUiThread(()->{call.reject("Update verification/download failed: "+e.getMessage(),e);call.setKeepAlive(false);});}});}
    private boolean isAllowedUpdateUrl(String u){try{Uri x=Uri.parse(u);return "https".equalsIgnoreCase(x.getScheme())&&"github.com".equalsIgnoreCase(x.getHost())&&x.getPath()!=null&&x.getPath().startsWith("/"+REPO+"/releases/download/");}catch(Exception e){return false;}}
    private void verifySha256(File f,String expected)throws Exception{MessageDigest d=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1)d.update(b,0,n);}String actual=toHex(d.digest());if(!MessageDigest.isEqual(actual.getBytes(StandardCharsets.US_ASCII),expected.toLowerCase(Locale.US).getBytes(StandardCharsets.US_ASCII)))throw new SecurityException("Downloaded APK integrity check failed.");}
    private String toHex(byte[] b){StringBuilder s=new StringBuilder(b.length*2);for(byte x:b)s.append(String.format(Locale.US,"%02x",x&255));return s.toString();}
    private void verifyDownloadedApk(File apk)throws Exception{PackageManager pm=getContext().getPackageManager();PackageInfo i=Build.VERSION.SDK_INT>=Build.VERSION_CODES.TIRAMISU?pm.getPackageArchiveInfo(apk.getAbsolutePath(),PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES)):pm.getPackageArchiveInfo(apk.getAbsolutePath(),PackageManager.GET_SIGNATURES);if(i==null)throw new SecurityException("Downloaded file is not a valid Android APK.");if(!getContext().getPackageName().equals(i.packageName))throw new SecurityException("Update APK belongs to a different application.");if(!MessageDigest.isEqual(getInstalledCertificate(),getDownloadedCertificate(i)))throw new SecurityException("Update APK signing certificate does not match this application.");}
    private byte[] getInstalledCertificate()throws Exception{PackageManager pm=getContext().getPackageManager();if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P){PackageInfo i=pm.getPackageInfo(getContext().getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);if(i.signingInfo==null||i.signingInfo.getApkContentsSigners().length==0)throw new SecurityException("Installed application has no signing certificate.");return certificateDigest(i.signingInfo.getApkContentsSigners()[0]);}PackageInfo i=pm.getPackageInfo(getContext().getPackageName(),PackageManager.GET_SIGNATURES);if(i.signatures==null||i.signatures.length==0)throw new SecurityException("Installed application has no signing certificate.");return certificateDigest(i.signatures[0]);}
    private byte[] getDownloadedCertificate(PackageInfo i)throws Exception{if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P){if(i.signingInfo==null||i.signingInfo.getApkContentsSigners().length==0)throw new SecurityException("Downloaded APK has no signing certificate.");return certificateDigest(i.signingInfo.getApkContentsSigners()[0]);}if(i.signatures==null||i.signatures.length==0)throw new SecurityException("Downloaded APK has no signing certificate.");return certificateDigest(i.signatures[0]);}
    private byte[] certificateDigest(Signature s)throws Exception{return MessageDigest.getInstance("SHA-256").digest(s.toByteArray());}
    @Override protected void handleOnDestroy(){executor.shutdownNow();super.handleOnDestroy();}
}
