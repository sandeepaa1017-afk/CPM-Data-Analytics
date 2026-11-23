package com.cpm.employee.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cpm.employee.data.ApiService
import com.cpm.employee.data.CallLogRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException

class ManagerSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val deviceId = inputData.getString(KEY_DEVICE_ID) ?: return Result.failure()
        val requestId = inputData.getString(KEY_REQUEST_ID) ?: return Result.failure()
        val repository = CallLogRepository(applicationContext)
        val fcmToken = repository.fcmToken() ?: return Result.retry()
        val username = repository.activeUsername()
            ?: return reportFailure(deviceId, requestId, fcmToken, "Employee must sign in.")
        val consentAt = repository.consentGrantedAt(username)
            ?: return reportFailure(deviceId, requestId, fcmToken, "Call-log consent is required.")
        if (!repository.hasPermission()) {
            return reportFailure(
                deviceId,
                requestId,
                fcmToken,
                "Android call-log permission is required."
            )
        }

        return try {
            val savedCursor = repository.cursor(username, deviceId)
                ?.takeIf { it.dateMillis >= consentAt }
            val batch = withContext(Dispatchers.IO) {
                repository.readCalls(
                    sinceEpochMillis = savedCursor?.dateMillis ?: consentAt,
                    afterCallId = savedCursor?.callId
                )
            }
            ApiService.completeManagerSync(
                deviceId = deviceId,
                requestId = requestId,
                fcmToken = fcmToken,
                calls = batch.records
            )
            batch.nextCursor?.let {
                repository.saveCursor(username, deviceId, it)
            }
            Result.success()
        } catch (error: SecurityException) {
            reportFailure(
                deviceId,
                requestId,
                fcmToken,
                error.message ?: "Android call-log permission is required."
            )
        } catch (error: IOException) {
            Result.retry()
        }
    }

    private suspend fun reportFailure(
        deviceId: String,
        requestId: String,
        fcmToken: String,
        message: String
    ): Result = try {
        ApiService.completeManagerSync(
            deviceId = deviceId,
            requestId = requestId,
            fcmToken = fcmToken,
            calls = emptyList(),
            error = message
        )
        Result.failure()
    } catch (error: IOException) {
        Result.retry()
    }

    companion object {
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_REQUEST_ID = "request_id"
    }
}
