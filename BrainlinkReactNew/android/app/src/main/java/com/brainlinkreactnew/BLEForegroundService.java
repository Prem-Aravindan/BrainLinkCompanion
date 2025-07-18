package com.brainlinkreactnew;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * BLE Foreground Service to keep DirectBLE scanning alive
 * Prevents Android from killing BLE operations after 15 seconds
 */
public class BLEForegroundService extends Service {
    private static final String TAG = "BLEForegroundService";
    private static final String CHANNEL_ID = "BLE_SCAN_CHANNEL";
    private static final int NOTIFICATION_ID = 1001;
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "BLE Foreground Service created");
        createNotificationChannel();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "BLE Foreground Service started");
        
        // Create notification for foreground service
        Notification notification = createNotification();
        
        // Promote to foreground service
        startForeground(NOTIFICATION_ID, notification);
        
        // Return START_STICKY to restart if killed
        return START_STICKY;
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }
    
    @Override
    public void onDestroy() {
        Log.d(TAG, "BLE Foreground Service destroyed");
        super.onDestroy();
    }
    
    /**
     * Handle app being swiped away - restart service
     */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.d(TAG, "Task removed - scheduling restart");
        
        Intent restartIntent = new Intent(getApplicationContext(), BLEForegroundService.class);
        PendingIntent pendingIntent = PendingIntent.getService(
            getApplicationContext(), 
            1, 
            restartIntent, 
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );
        
        android.app.AlarmManager mgr = (android.app.AlarmManager) getSystemService(Context.ALARM_SERVICE);
        mgr.set(
            android.app.AlarmManager.ELAPSED_REALTIME,
            android.os.SystemClock.elapsedRealtime() + 1000,
            pendingIntent
        );
        
        super.onTaskRemoved(rootIntent);
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "BLE Scanner",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps BLE scanning active for BrainLink device");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }
    
    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            notificationIntent, 
            PendingIntent.FLAG_IMMUTABLE
        );
        
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BrainLink Active")
            .setContentText("Scanning for EEG device...")
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Use system icon for now
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }
}
