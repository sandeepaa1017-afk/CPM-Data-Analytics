package com.cpm.employee.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import java.io.IOException
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import org.json.JSONObject

data class CallLogCursor(
    val dateMillis: Long,
    val callId: Long
)

data class CallLogBatch(
    val records: List<JSONObject>,
    val nextCursor: CallLogCursor?
)

class CallLogRepository(context: Context) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE
    )

    fun hasPermission(): Boolean =
        appContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) ==
            PackageManager.PERMISSION_GRANTED

    fun consentGrantedAt(username: String): Long? =
        preferences.getLong(consentKey(username), 0L).takeIf { it > 0L }

    fun acceptConsent(username: String) {
        preferences.edit()
            .putLong(consentKey(username), System.currentTimeMillis())
            .apply()
    }

    fun revokeConsent(username: String) {
        preferences.edit().remove(consentKey(username)).apply()
    }

    fun setActiveUsername(username: String) {
        preferences.edit().putString(ACTIVE_USERNAME_KEY, username).apply()
    }

    fun activeUsername(): String? =
        preferences.getString(ACTIVE_USERNAME_KEY, null)

    fun clearActiveUsername() {
        preferences.edit().remove(ACTIVE_USERNAME_KEY).apply()
    }

    fun saveFcmToken(token: String) {
        preferences.edit().putString(FCM_TOKEN_KEY, token).apply()
    }

    fun fcmToken(): String? = preferences.getString(FCM_TOKEN_KEY, null)

    fun deviceId(): String {
        val savedId = preferences.getString(DEVICE_ID_KEY, null)
        if (savedId != null) return savedId

        return UUID.randomUUID().toString().also { id ->
            preferences.edit().putString(DEVICE_ID_KEY, id).apply()
        }
    }

    fun cursor(username: String, deviceId: String): CallLogCursor? {
        val key = cursorKey(username, deviceId)
        val date = preferences.getLong("$key:date", 0L)
        val id = preferences.getLong("$key:id", -1L)
        return if (date > 0L && id >= 0L) CallLogCursor(date, id) else null
    }

    fun saveCursor(username: String, deviceId: String, cursor: CallLogCursor) {
        val key = cursorKey(username, deviceId)
        preferences.edit()
            .putLong("$key:date", cursor.dateMillis)
            .putLong("$key:id", cursor.callId)
            .apply()
    }

    fun readCalls(sinceEpochMillis: Long, afterCallId: Long? = null): CallLogBatch {
        if (!hasPermission()) {
            throw SecurityException("Allow call-log access in Android settings before syncing.")
        }

        val records = mutableListOf<JSONObject>()
        var nextCursor: CallLogCursor? = null
        val selection = if (afterCallId == null) {
            "${CallLog.Calls.DATE} > ?"
        } else {
            "(${CallLog.Calls.DATE} > ? OR " +
                "(${CallLog.Calls.DATE} = ? AND ${CallLog.Calls._ID} > ?))"
        }
        val selectionArgs = if (afterCallId == null) {
            arrayOf(sinceEpochMillis.coerceAtLeast(0L).toString())
        } else {
            arrayOf(
                sinceEpochMillis.coerceAtLeast(0L).toString(),
                sinceEpochMillis.coerceAtLeast(0L).toString(),
                afterCallId.toString()
            )
        }
        val cursor = appContext.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            PROJECTION,
            selection,
            selectionArgs,
            "${CallLog.Calls.DATE} ASC, ${CallLog.Calls._ID} ASC"
        ) ?: throw IOException("Android could not open the call history.")

        cursor.use { callCursor ->
            val idColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls._ID)
            val numberColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
            val typeColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
            val dateColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
            val durationColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)

            while (records.size < MAX_BATCH_SIZE && callCursor.moveToNext()) {
                val callId = callCursor.getLong(idColumn)
                val callDate = callCursor.getLong(dateColumn)
                nextCursor = CallLogCursor(callDate, callId)
                val phone = callCursor.getString(numberColumn)?.trim().orEmpty()
                val callType = callType(callCursor.getInt(typeColumn))
                if (phone.isBlank() || callType == null) continue

                val duration = callCursor.getLong(durationColumn).coerceAtLeast(0L)
                    .coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
                val status = if (
                    callType == "missed" ||
                    callType == "rejected" ||
                    duration == 0
                ) {
                    "missed"
                } else {
                    "answered"
                }

                records += JSONObject()
                    .put("phoneNumber", phone)
                    .put("callType", callType)
                    .put("status", status)
                    .put("durationSec", duration)
                    .put(
                        "dateTime",
                        Instant.ofEpochMilli(callDate).toString()
                    )
            }
        }
        return CallLogBatch(records, nextCursor)
    }

    fun readCallHistory(sinceEpochMillis: Long): List<CallRecord> {
        if (!hasPermission()) {
            throw SecurityException("Allow call-log access in Android settings to view call history.")
        }

        val cursor = appContext.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            PROJECTION,
            "${CallLog.Calls.DATE} > ?",
            arrayOf(sinceEpochMillis.coerceAtLeast(0L).toString()),
            "${CallLog.Calls.DATE} DESC, ${CallLog.Calls._ID} DESC"
        ) ?: throw IOException("Android could not open the call history.")

        val zone = ZoneId.systemDefault()
        val dateFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.getDefault())
        val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.getDefault())
        return cursor.use { callCursor ->
            val idColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls._ID)
            val numberColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
            val typeColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
            val dateColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
            val durationColumn = callCursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)
            buildList {
                while (callCursor.moveToNext()) {
                    val phone = callCursor.getString(numberColumn)?.trim().orEmpty()
                    val type = callType(callCursor.getInt(typeColumn))
                    if (phone.isBlank() || type == null) continue

                    val dateMillis = callCursor.getLong(dateColumn)
                    val localDateTime = Instant.ofEpochMilli(dateMillis).atZone(zone)
                    val duration = callCursor.getLong(durationColumn)
                        .coerceAtLeast(0L)
                        .coerceAtMost(Int.MAX_VALUE.toLong())
                        .toInt()
                    val status = if (
                        type == "missed" ||
                        type == "rejected" ||
                        duration == 0
                    ) {
                        "missed"
                    } else {
                        "answered"
                    }

                    add(
                        CallRecord(
                            id = callCursor.getLong(idColumn).toString(),
                            phone = phone,
                            type = when (type) {
                                "incoming" -> CallType.INCOMING
                                "outgoing" -> CallType.OUTGOING
                                "rejected" -> CallType.REJECTED
                                else -> CallType.MISSED
                            },
                            date = localDateTime.format(dateFormatter),
                            time = localDateTime.format(timeFormatter),
                            durationSeconds = duration,
                            status = status,
                            dateTimeMillis = dateMillis
                        )
                    )
                }
            }
        }
    }

    private fun consentKey(username: String) = "call_log_consent:$username"

    private fun cursorKey(username: String, deviceId: String) =
        "call_log_cursor:$username:$deviceId"

    private fun callType(type: Int): String? = when (type) {
        CallLog.Calls.INCOMING_TYPE -> "incoming"
        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
        CallLog.Calls.MISSED_TYPE -> "missed"
        CallLog.Calls.REJECTED_TYPE, CallLog.Calls.BLOCKED_TYPE -> "rejected"
        else -> null
    }

    private companion object {
        const val PREFERENCES_NAME = "cpm_call_log_preferences"
        const val DEVICE_ID_KEY = "device_id"
        const val ACTIVE_USERNAME_KEY = "active_username"
        const val FCM_TOKEN_KEY = "fcm_token"
        const val MAX_BATCH_SIZE = 5000
        val PROJECTION = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION
        )
    }
}
