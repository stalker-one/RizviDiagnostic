package com.rizvi.diagnosticcenter;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "AndroidUpdate",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class UpdatePlugin extends Plugin {
    private static final String REPO = "stalker-one/RizviDiagnostic";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod public void getVersion(PluginCall call){try{PackageInfo i=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);long c=Build.VERSION.SDK_INT>=Build.VERSION_CODES.P?i.getLongVersionCode():i.versionCode;JSObject r=new JSObject();r.put("versionCode",c);r.put("versionName",i.versionName==null?"":i.versionName);call.resolve(r);}catch(Exception e){call.reject("Unable to read installed Android app version: "+e.getMessage(),e);}}

    // Proactively asks for the Android 13+ notification permission as soon
    // as the app is opened and the user is logged in, regardless of
    // whether an update happens to be available right now. Without this,
    // a device that's already on the latest app version would never see
    // any notification permission prompt at all (notifyUpdateAvailable is
    // the only other place that requests it, and it's only called when an
    // update actually exists) -- meaning patient/invoice push
    // notifications would silently never be able to post on that device.
    @PluginMethod public void ensureNotificationPermission(PluginCall call){
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){
            requestPermissionForAlias("notifications",call,"notificationPermCallback");
            return;
        }
        JSObject r=new JSObject();r.put("granted",true);call.resolve(r);
    }

    // Posts a system notification (status bar / notification tray) telling
    // the user a new update is available, so they see it even if the app is
    // in the background or minimized -- not just the in-app modal, which
    // only shows while the app is actually open.
    @PluginMethod public void notifyUpdateAvailable(PluginCall call){
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){
            requestPermissionForAlias("notifications",call,"notificationPermCallback");
            return;
        }
        postUpdateNotification(call);
    }

    // Posts a one-off activity notification (patient created, invoice
    // created, etc.) -- same permission flow as notifyUpdateAvailable, but
    // on its own notification channel so it doesn't collide with or get
    // replaced by an update notification.
    @PluginMethod public void notifyActivity(PluginCall call){
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){
            requestPermissionForAlias("notifications",call,"notificationPermCallback");
            return;
        }
        postActivityNotification(call);
    }

    @PermissionCallback
    private void notificationPermCallback(PluginCall call){
        boolean granted=Build.VERSION.SDK_INT<33||getPermissionState("notifications")==PermissionState.GRANTED;
        if(!granted){
            JSObject r=new JSObject();r.put("posted",false);r.put("granted",false);r.put("permissionDenied",true);call.resolve(r);
            return;
        }
        String method=call.getMethodName();
        if("notifyActivity".equals(method)){
            postActivityNotification(call);
        }else if("notifyUpdateAvailable".equals(method)){
            postUpdateNotification(call);
        }else{
            JSObject r=new JSObject();r.put("granted",true);call.resolve(r);
        }
    }

    private void postUpdateNotification(PluginCall call){
        String title=call.getString("title","Update available");
        String message=call.getString("message","A new version is ready to install.");
        long versionCode=call.getInt("versionCode",0);
        boolean posted=NotificationHelper.postIfNewVersion(getContext(),versionCode,title,message);
        JSObject r=new JSObject();r.put("posted",posted);call.resolve(r);
    }

    private void postActivityNotification(PluginCall call){
        String title=call.getString("title","Notification");
        String message=call.getString("message","");
        boolean posted=NotificationHelper.postActivity(getContext(),title,message);
        JSObject r=new JSObject();r.put("posted",posted);call.resolve(r);
    }

    // Used by App.jsx to fetch the current device's push token and register
    // it with the backend (JS has the authenticated axios instance with the
    // correct backend URL already available, so registration happens there
    // rather than from native code).
    @PluginMethod public void getFcmToken(PluginCall call){
        try{
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{
                if(task.isSuccessful()){
                    JSObject r=new JSObject();r.put("token",task.getResult());call.resolve(r);
                }else{
                    call.reject("Unable to get FCM token: "+(task.getException()!=null?task.getException().getMessage():"unknown error"));
                }
            });
        }catch(Exception e){
            call.reject("Firebase Messaging is not available: "+e.getMessage(),e);
        }
    }

    @PluginMethod public void checkForUpdate(PluginCall call){executor.execute(()->{try{PackageInfo installed=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);long installedCode=Build.VERSION.SDK_INT>=Build.VERSION_CODES.P?installed.getLongVersionCode():installed.versionCode;String pkg=installed.packageName;JSONObject release=UpdateChecker.fetchRelease(getContext(),UpdateChecker.releaseTag(pkg));JSONObject apk=UpdateChecker.findBestApk(release.optJSONArray("assets"),UpdateChecker.apkName(pkg));JSObject r=new JSObject();r.put("available",false);r.put("installedVersionCode",installedCode);r.put("installedVersionName",installed.versionName==null?"":installed.versionName);r.put("packageName",pkg);r.put("tag",UpdateChecker.releaseTag(pkg));r.put("releaseName",release.optString("name",UpdateChecker.releaseTag(pkg)));String body=release.optString("body","");body=body.replace("\\r\\n","\n").replace("\\r","").replace("\\n","\n");r.put("releaseNotes",UpdateChecker.cleanReleaseNotes(body));if(apk==null){call.resolve(r);return;}long remote=UpdateChecker.extractNumber(body,"Version code\\s*:\\s*(\\d+)");if(remote<=0)remote=UpdateChecker.extractNumber(body,"Version\\s*(?:Code|Build)\\s*[:=]\\s*(\\d+)");if(remote<=0)remote=UpdateChecker.extractNumber(apk.optString("name",""),"(?:-|_)(\\d+)(?:-|_)[0-9a-f]{7,40}\\.apk$");if(remote<=0)remote=UpdateChecker.extractNumber(apk.optString("name",""),"(?:-|_)(\\d+)\\.apk$");if(remote<=0){call.resolve(r);return;}if(remote<=installedCode){call.resolve(r);return;}String vn=UpdateChecker.extractText(body,"Version name\\s*:\\s*([^\\r\\n]+)");r.put("available",true);r.put("versionCode",remote);r.put("versionName",vn.isEmpty()?"1.0."+remote:vn);r.put("url",apk.optString("browser_download_url",""));r.put("sha256",UpdateChecker.extractSha256(body));long size=apk.optLong("size",0);r.put("sizeBytes",size);r.put("sizeMB",Math.round((size/1024d/1024d)*10d)/10d);r.put("commit",UpdateChecker.extractText(body,"commit\\s+([0-9a-f]{7,40})"));call.resolve(r);}catch(Exception e){JSObject r=new JSObject();try{PackageInfo installed=getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);r.put("installedVersionCode",Build.VERSION.SDK_INT>=Build.VERSION_CODES.P?installed.getLongVersionCode():installed.versionCode);r.put("installedVersionName",installed.versionName==null?"":installed.versionName);}catch(Exception ignored){}r.put("available",false);r.put("offline",true);call.resolve(r);}});}

    @PluginMethod public void installApk(PluginCall call){String url=call.getString("url","");if(url==null||url.trim().isEmpty()){call.reject("Update download URL is missing.");return;}if(!url.startsWith("https://")||!isAllowedUpdateUrl(url)){call.reject("Update source is not an approved Rizvi Diagnostic release URL.");return;}if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O&&!getContext().getPackageManager().canRequestPackageInstalls()){try{getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getContext().getPackageName())));call.reject("Please allow this app to install updates, then tap Update Now again.");}catch(Exception e){call.reject("Android installation permission is required: "+e.getMessage(),e);}return;}call.setKeepAlive(true);executor.execute(()->{File apk=new File(getContext().getCacheDir(),"rizvi-diagnostic-update.apk");try{JSONObject release=UpdateChecker.fetchRelease(getContext(),UpdateChecker.releaseTag(getContext().getPackageName()));JSONObject asset=UpdateChecker.findBestApk(release.optJSONArray("assets"),UpdateChecker.apkName(getContext().getPackageName()));if(asset==null)throw new SecurityException("Approved update APK was not found in the latest release.");String approved=asset.optString("browser_download_url","");if(!url.equals(approved))throw new SecurityException("Update URL does not match the approved latest release asset.");String expected=UpdateChecker.extractSha256(release.optString("body",""));if(expected.isEmpty())throw new SecurityException("Latest release has no APK integrity hash.");File background=null;File backgroundDir=getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);if(backgroundDir!=null){File[] candidates=backgroundDir.listFiles((dir,name)->name.startsWith("rizvi-update-")&&name.endsWith(".apk"));if(candidates!=null)for(File candidate:candidates)if(candidate.isFile()&&candidate.length()>10000){try{verifySha256(candidate,expected);background=candidate;break;}catch(Exception ignored){}}}if(background!=null){apk=background;}else if(apk.exists()&&!apk.delete())throw new IllegalStateException("Unable to clear the previous update file.");if(background!=null){verifyDownloadedApk(apk);}else{HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(120000);c.setInstanceFollowRedirects(true);c.setRequestProperty("User-Agent","RizviDiagnosticCenter-Android-Updater/8");c.connect();int response=c.getResponseCode();if(response<200||response>=300)throw new IllegalStateException("Update server returned HTTP "+response);long total=c.getContentLengthLong();try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(apk)){byte[] b=new byte[16384];long done=0;int n,last=-1;while((n=in.read(b))!=-1){out.write(b,0,n);done+=n;int pct=total>0?(int)Math.min(99,(done*100L)/total):-1;if(pct!=last){last=pct;JSObject p=new JSObject();p.put("percent",pct);p.put("downloadedBytes",done);p.put("totalBytes",total);notifyListeners("updateProgress",p);}}}finally{c.disconnect();}if(!apk.isFile()||apk.length()<10000)throw new IllegalStateException("Downloaded update APK is incomplete.");verifySha256(apk,expected);verifyDownloadedApk(apk);}JSObject done=new JSObject();done.put("percent",100);done.put("downloadedBytes",apk.length());done.put("totalBytes",apk.length());notifyListeners("updateProgress",done);getActivity().runOnUiThread(()->{try{Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",apk);Intent i=new Intent(Intent.ACTION_VIEW);i.setDataAndType(uri,"application/vnd.android.package-archive");i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);getActivity().startActivity(i);call.resolve();}catch(Exception e){call.reject("Unable to start Android update installer: "+e.getMessage(),e);}finally{call.setKeepAlive(false);}});}catch(Exception e){getActivity().runOnUiThread(()->{call.reject("Update verification/download failed: "+e.getMessage(),e);call.setKeepAlive(false);});}});}
    private boolean isAllowedUpdateUrl(String u){try{Uri x=Uri.parse(u);return "https".equalsIgnoreCase(x.getScheme())&&"github.com".equalsIgnoreCase(x.getHost())&&x.getPath()!=null&&x.getPath().startsWith("/"+REPO+"/releases/download/");}catch(Exception e){return false;}}
    private void verifySha256(File f,String expected)throws Exception{MessageDigest d=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1)d.update(b,0,n);}String actual=toHex(d.digest());if(!MessageDigest.isEqual(actual.getBytes(StandardCharsets.US_ASCII),expected.toLowerCase(Locale.US).getBytes(StandardCharsets.US_ASCII)))throw new SecurityException("Downloaded APK integrity check failed.");}
    private String toHex(byte[] b){StringBuilder s=new StringBuilder(b.length*2);for(byte x:b)s.append(String.format(Locale.US,"%02x",x&255));return s.toString();}
    private void verifyDownloadedApk(File apk)throws Exception{PackageManager pm=getContext().getPackageManager();PackageInfo i=Build.VERSION.SDK_INT>=Build.VERSION_CODES.TIRAMISU?pm.getPackageArchiveInfo(apk.getAbsolutePath(),PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES)):pm.getPackageArchiveInfo(apk.getAbsolutePath(),PackageManager.GET_SIGNATURES);if(i==null)throw new SecurityException("Downloaded file is not a valid Android APK.");if(!getContext().getPackageName().equals(i.packageName))throw new SecurityException("Update APK belongs to a different application.");if(!MessageDigest.isEqual(getInstalledCertificate(),getDownloadedCertificate(i)))throw new SecurityException("Update APK signing certificate does not match this application.");}
    private byte[] getInstalledCertificate()throws Exception{PackageManager pm=getContext().getPackageManager();if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P){PackageInfo i=pm.getPackageInfo(getContext().getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES);if(i.signingInfo==null||i.signingInfo.getApkContentsSigners().length==0)throw new SecurityException("Installed application has no signing certificate.");return certificateDigest(i.signingInfo.getApkContentsSigners()[0]);}PackageInfo i=pm.getPackageInfo(getContext().getPackageName(),PackageManager.GET_SIGNATURES);if(i.signatures==null||i.signatures.length==0)throw new SecurityException("Installed application has no signing certificate.");return certificateDigest(i.signatures[0]);}
    private byte[] getDownloadedCertificate(PackageInfo i)throws Exception{if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P){if(i.signingInfo==null||i.signingInfo.getApkContentsSigners().length==0)throw new SecurityException("Downloaded APK has no signing certificate.");return certificateDigest(i.signingInfo.getApkContentsSigners()[0]);}if(i.signatures==null||i.signatures.length==0)throw new SecurityException("Downloaded APK has no signing certificate.");return certificateDigest(i.signatures[0]);}
    private byte[] certificateDigest(Signature s)throws Exception{return MessageDigest.getInstance("SHA-256").digest(s.toByteArray());}
    @Override protected void handleOnDestroy(){executor.shutdownNow();super.handleOnDestroy();}
}
