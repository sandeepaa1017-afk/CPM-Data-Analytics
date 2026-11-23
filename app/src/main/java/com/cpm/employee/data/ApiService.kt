package com.cpm.employee.data

import com.cpm.employee.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL

data class EmployeeSession(
    val accessToken: String,
    val employeeId: String?,
    val username: String,
    val role: String,
    val name: String
)

data class CallSyncResult(
    val received: Int,
    val inserted: Int,
    val duplicates: Int,
    val rejected: Int
)

class ApiException(
    val statusCode: Int,
    message: String
) : IOException(message)

object ApiService {
    private const val CONNECT_TIMEOUT_MS = 10_000
    private const val READ_TIMEOUT_MS = 20_000
    private val baseUrl = BuildConfig.CPM_API_BASE_URL.trimEnd('/')

    suspend fun login(username: String, password: String): EmployeeSession {
        val response = request(
            method = "POST",
            path = "/auth/login",
            body = JSONObject()
                .put("username", username)
                .put("password", password)
        )
        val user = response.getJSONObject("user")
        return EmployeeSession(
            accessToken = response.getString("access_token"),
            employeeId = user.optString("employeeId").takeIf { it.isNotBlank() },
            username = user.getString("username"),
            role = user.getString("role"),
            name = user.optString("name").ifBlank { user.getString("username") }
        )
    }

    suspend fun changePassword(
        currentPassword: String,
        newPassword: String,
        accessToken: String
    ) {
        request(
            method = "POST",
            path = "/auth/change-password",
            accessToken = accessToken,
            body = JSONObject()
                .put("current_password", currentPassword)
                .put("new_password", newPassword)
        )
    }

    suspend fun getLastSync(deviceId: String, accessToken: String): String? {
        val encodedDeviceId = URLEncoder.encode(deviceId, Charsets.UTF_8.name())
        val response = request(
            method = "GET",
            path = "/sync/last?deviceId=$encodedDeviceId",
            accessToken = accessToken
        )
        return response.optString("lastSyncedAt").takeIf { it.isNotBlank() }
    }

    suspend fun registerDevice(
        deviceId: String,
        fcmToken: String,
        accessToken: String
    ) {
        request(
            method = "POST",
            path = "/sync/device/register",
            accessToken = accessToken,
            body = JSONObject()
                .put("deviceId", deviceId)
                .put("fcmToken", fcmToken)
        )
    }

    suspend fun completeManagerSync(
        deviceId: String,
        requestId: String,
        fcmToken: String,
        calls: List<JSONObject>,
        error: String? = null
    ): CallSyncResult {
        val body = JSONObject()
            .put("requestId", requestId)
            .put("fcmToken", fcmToken)
            .put("calls", JSONArray(calls))
        if (error != null) body.put("error", error)
        val response = request(
            method = "POST",
            path = "/sync/devices/${URLEncoder.encode(deviceId, Charsets.UTF_8.name())}/complete",
            body = body
        )
        return CallSyncResult(
            received = response.getInt("received"),
            inserted = response.getInt("inserted"),
            duplicates = response.getInt("duplicates"),
            rejected = response.getInt("rejected")
        )
    }

    private suspend fun request(
        method: String,
        path: String,
        accessToken: String? = null,
        body: JSONObject? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val connection = URL("$baseUrl$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.setRequestProperty("Accept", "application/json")
            if (accessToken != null) {
                connection.setRequestProperty("Authorization", "Bearer $accessToken")
            }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.bufferedWriter(Charsets.UTF_8).use {
                    it.write(body.toString())
                }
            }

            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }
            val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use {
                it.readText()
            }.orEmpty()
            if (statusCode !in 200..299) {
                val detail = try {
                    JSONObject(responseText).optString("detail")
                } catch (_: JSONException) {
                    ""
                }
                throw ApiException(
                    statusCode,
                    detail.ifBlank { "CPM API request failed ($statusCode)." }
                )
            }
            if (responseText.isBlank()) JSONObject() else JSONObject(responseText)
        } finally {
            connection.disconnect()
        }
    }
}
