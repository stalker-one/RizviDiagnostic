package com.rizvi.diagnosticcenter;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DateFormat;
import java.util.Date;

/** Native notification center shared by the Staff and Superadmin Android builds. */
public class NotificationCenterActivity extends Activity {
    private LinearLayout list;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
    }

    private int dp(float value) { return (int)(value * getResources().getDisplayMetrics().density + .5f); }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value); v.setTextSize(size); v.setTextColor(color);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(248,250,252));
        LinearLayout header = new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL); header.setPadding(dp(20),dp(18),dp(14),dp(12)); header.setBackgroundColor(Color.WHITE);
        TextView title = text("Notifications", 22, Color.rgb(15,23,42), true); header.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        Button mark = new Button(this); mark.setText("Mark all read"); mark.setOnClickListener(v -> { NotificationHelper.markAllRead(this); renderHistory(); }); header.addView(mark, new LinearLayout.LayoutParams(-2,-2));
        root.addView(header);

        ScrollView scroll = new ScrollView(this);
        list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); list.setPadding(dp(16),dp(14),dp(16),dp(24));
        scroll.addView(list); root.addView(scroll, new LinearLayout.LayoutParams(-1,0,1));

        LinearLayout settings = new LinearLayout(this); settings.setOrientation(LinearLayout.VERTICAL); settings.setPadding(dp(18),dp(10),dp(18),dp(18)); settings.setBackgroundColor(Color.WHITE);
        TextView st = text("Notification settings",15,Color.rgb(15,23,42),true); settings.addView(st);
        addSwitch(settings,"Patient & invoice notifications",NotificationHelper.isActivityEnabled(this),v -> NotificationHelper.setPreference(this,"notifications_activity_enabled",v));
        addSwitch(settings,"Application updates",NotificationHelper.isUpdateEnabled(this),v -> NotificationHelper.setPreference(this,"notifications_update_enabled",v));
        addSwitch(settings,"Sound",NotificationHelper.isSoundEnabled(this),v -> NotificationHelper.setPreference(this,"notifications_sound_enabled",v));
        addSwitch(settings,"Vibration",NotificationHelper.isVibrationEnabled(this),v -> NotificationHelper.setPreference(this,"notifications_vibration_enabled",v));
        Button clear = new Button(this); clear.setText("Clear notification history"); clear.setOnClickListener(v -> { NotificationHelper.clearHistory(this); renderHistory(); }); settings.addView(clear);
        root.addView(settings);
        setContentView(root);
        renderHistory();
    }

    private void addSwitch(LinearLayout parent,String label,boolean checked,final Toggle callback){
        Switch sw = new Switch(this); sw.setText(label); sw.setTextSize(14); sw.setTextColor(Color.rgb(51,65,85)); sw.setChecked(checked); sw.setPadding(0,dp(4),0,dp(4)); sw.setOnCheckedChangeListener((button,isChecked)->callback.set(isChecked)); parent.addView(sw,new LinearLayout.LayoutParams(-1,-2));
    }
    private interface Toggle { void set(boolean value); }

    private void renderHistory() {
        list.removeAllViews(); JSONArray history = NotificationHelper.getHistory(this);
        if (history.length()==0) { TextView empty=text("No notifications yet.",14,Color.rgb(100,116,139),false); empty.setGravity(Gravity.CENTER); empty.setPadding(0,dp(40),0,dp(40)); list.addView(empty); return; }
        DateFormat df = DateFormat.getDateTimeInstance(DateFormat.SHORT,DateFormat.SHORT);
        for(int i=0;i<history.length();i++) {
            JSONObject item=history.optJSONObject(i); if(item==null) continue;
            LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(14),dp(13),dp(14),dp(13)); card.setBackgroundColor(item.optBoolean("read",false)?Color.WHITE:Color.rgb(239,246,255));
            TextView h=text(item.optString("title","Notification"),15,Color.rgb(15,23,42),true); card.addView(h);
            TextView b=text(item.optString("message",""),13,Color.rgb(51,65,85),false); b.setPadding(0,dp(5),0,dp(3)); card.addView(b);
            TextView d=text(df.format(new Date(item.optLong("timestamp",System.currentTimeMillis()))),11,Color.rgb(100,116,139),false); card.addView(d);
            LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,-2); cp.setMargins(0,0,0,dp(8)); list.addView(card,cp);
        }
    }
}
