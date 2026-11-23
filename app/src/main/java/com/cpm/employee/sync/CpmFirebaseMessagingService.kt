package com.cpm.employee.sync

import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.cpm.employee.data.CallLogRepository

class CpmFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        CallLogRepository(applicationContext).saveFcmToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (data["type"] != SYNC_COMMAND) return

        val deviceId = data["deviceId"] ?: return
        val requestId = data["requestId"] ?: return
        val request = OneTimeWorkRequestBuilder<ManagerSyncWorker>()
            .setInputData(
                workDataOf(
                    ManagerSyncWorker.KEY_DEVICE_ID to deviceId,
                    ManagerSyncWorker.KEY_REQUEST_ID to requestId
                )
            )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniqueWork(
            "manager-sync-$requestId",
            ExistingWorkPolicy.KEEP,
            request
        )
    }

    private companion object {
        const val SYNC_COMMAND = "manager_sync"
    }
}
