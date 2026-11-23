package com.cpm.employee

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.cpm.employee.data.ApiService
import com.cpm.employee.data.CallRecord
import com.cpm.employee.data.CallLogRepository
import com.cpm.employee.data.CallFilter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.IOException

data class EmployeeUiState(
    val employeeName: String = "Employee",
    val employeeId: String = "",
    val role: String = "Employee",
    val branch: String = "",
    val phone: String = "",
    val email: String = "",
    val filter: CallFilter = CallFilter.ALL,
    val callRecords: List<CallRecord> = emptyList(),
    val isLoadingCallHistory: Boolean = false,
    val callHistoryError: String? = null,
    val searchQuery: String = "",
    val loginError: String? = null,
    val isLoggingIn: Boolean = false,
    val isChangingPassword: Boolean = false,
    val passwordChangeMessage: String? = null,
    val passwordChangeError: Boolean = false,
    val passwordChangeSucceeded: Boolean = false,
    val isAuthenticated: Boolean = false,
    val username: String = "",
    val accessToken: String? = null,
    val callLogConsentAccepted: Boolean = false,
    val callLogPermissionGranted: Boolean = false,
    val isSyncing: Boolean = false,
    val pendingRecords: Int = 0,
    val successfulRecords: Int = 0,
    val failedRecords: Int = 0,
    val lastSynced: String = "Not synced",
    val syncMessage: String? = null,
    val syncError: Boolean = false,
    val notificationsEnabled: Boolean = true,
    val callSummaryEnabled: Boolean = true,
    val autoSyncEnabled: Boolean = false
)

class EmployeeViewModel(application: Application) : AndroidViewModel(application) {
    private val callLogRepository = CallLogRepository(application)
    private val _uiState = MutableStateFlow(EmployeeUiState())
    val uiState = _uiState.asStateFlow()

    fun login(username: String, password: String) {
        val normalizedUsername = username.trim()
        if (normalizedUsername.isBlank()) {
            _uiState.update { it.copy(loginError = "Enter your employee username.") }
            return
        }
        if (password.isBlank()) {
            _uiState.update { it.copy(loginError = "Enter your password.") }
            return
        }

        _uiState.update { it.copy(isLoggingIn = true, loginError = null) }
        viewModelScope.launch {
            try {
                val session = ApiService.login(normalizedUsername, password)
                if (session.role != "employee" || session.employeeId.isNullOrBlank()) {
                    _uiState.update {
                        it.copy(
                            isLoggingIn = false,
                            loginError = "Use an employee account linked to an employee record."
                        )
                    }
                    return@launch
                }

                callLogRepository.setActiveUsername(session.username)
                _uiState.update {
                    it.copy(
                        employeeId = session.employeeId,
                        employeeName = session.name,
                        role = "Employee",
                        branch = "",
                        phone = "",
                        email = "",
                        username = session.username,
                        accessToken = session.accessToken,
                        isAuthenticated = true,
                        isLoggingIn = false,
                        callLogConsentAccepted =
                            callLogRepository.consentGrantedAt(session.username) != null,
                        callLogPermissionGranted = callLogRepository.hasPermission(),
                        loginError = null,
                        pendingRecords = 0,
                        successfulRecords = 0,
                        failedRecords = 0,
                        lastSynced = "Not synced",
                        syncMessage = null
                    )
                }
                refreshCallHistory()
                registerDeviceForManagementSync(session.accessToken)
            } catch (error: IOException) {
                _uiState.update {
                    it.copy(isLoggingIn = false, loginError = error.message ?: "Sign-in failed.")
                }
            }
        }
    }

    fun setCallFilter(filter: CallFilter) {
        _uiState.update { it.copy(filter = filter) }
    }

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun clearLoginError() {
        _uiState.update { it.copy(loginError = null) }
    }

    fun clearPasswordChangeStatus() {
        _uiState.update {
            it.copy(
                passwordChangeMessage = null,
                passwordChangeError = false,
                passwordChangeSucceeded = false
            )
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        val token = _uiState.value.accessToken
        if (token.isNullOrBlank()) {
            _uiState.update {
                it.copy(
                    passwordChangeMessage = "Sign in again before changing your password.",
                    passwordChangeError = true,
                    passwordChangeSucceeded = false
                )
            }
            return
        }

        _uiState.update {
            it.copy(
                isChangingPassword = true,
                passwordChangeMessage = null,
                passwordChangeError = false,
                passwordChangeSucceeded = false
            )
        }
        viewModelScope.launch {
            try {
                ApiService.changePassword(currentPassword, newPassword, token)
                _uiState.update {
                    it.copy(
                        isChangingPassword = false,
                        passwordChangeMessage = "Password changed successfully.",
                        passwordChangeError = false,
                        passwordChangeSucceeded = true
                    )
                }
            } catch (error: IOException) {
                _uiState.update {
                    it.copy(
                        isChangingPassword = false,
                        passwordChangeMessage = error.message ?: "Unable to change password.",
                        passwordChangeError = true,
                        passwordChangeSucceeded = false
                    )
                }
            }
        }
    }

    fun setCallLogConsent(accepted: Boolean) {
        val username = _uiState.value.username
        if (username.isBlank()) return

        if (accepted) {
            callLogRepository.acceptConsent(username)
        } else {
            callLogRepository.revokeConsent(username)
        }
        _uiState.update {
            it.copy(
                callLogConsentAccepted = accepted,
                syncMessage = if (accepted) null else "Call-log syncing is turned off.",
                syncError = false
            )
        }
        refreshCallHistory()
    }

    fun refreshCallLogPermission() {
        val granted = callLogRepository.hasPermission()
        _uiState.update { it.copy(callLogPermissionGranted = granted) }
        refreshCallHistory()
    }

    fun setCallLogPermissionGranted(granted: Boolean) {
        _uiState.update {
            it.copy(
                callLogPermissionGranted = granted,
                syncMessage = if (granted) {
                    null
                } else {
                    "Permission denied. No call history was read or uploaded."
                },
                syncError = !granted
            )
        }
        refreshCallHistory()
    }

    fun refreshCallHistory() {
        val state = _uiState.value
        val username = state.username
        val consentAt = if (username.isBlank()) null else {
            callLogRepository.consentGrantedAt(username)
        }
        if (!state.callLogPermissionGranted || consentAt == null) {
            _uiState.update {
                it.copy(callRecords = emptyList(), isLoadingCallHistory = false, callHistoryError = null)
            }
            return
        }

        _uiState.update { it.copy(isLoadingCallHistory = true, callHistoryError = null) }
        viewModelScope.launch {
            try {
                val calls = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    callLogRepository.readCallHistory(consentAt)
                }
                _uiState.update {
                    it.copy(
                        callRecords = calls,
                        isLoadingCallHistory = false,
                        callHistoryError = null
                    )
                }
            } catch (error: IOException) {
                _uiState.update {
                    it.copy(
                        callRecords = emptyList(),
                        isLoadingCallHistory = false,
                        callHistoryError = error.message ?: "Unable to read call history."
                    )
                }
            } catch (error: SecurityException) {
                _uiState.update {
                    it.copy(
                        callRecords = emptyList(),
                        isLoadingCallHistory = false,
                        callHistoryError = error.message ?: "Call-log permission is required."
                    )
                }
            }
        }
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        _uiState.update { it.copy(notificationsEnabled = enabled) }
    }

    fun setCallSummaryEnabled(enabled: Boolean) {
        _uiState.update { it.copy(callSummaryEnabled = enabled) }
    }

    fun setAutoSyncEnabled(enabled: Boolean) {
        _uiState.update { it.copy(autoSyncEnabled = enabled) }
    }

    fun logout() {
        callLogRepository.clearActiveUsername()
        _uiState.update {
            it.copy(
                employeeName = "Employee",
                employeeId = "",
                role = "Employee",
                branch = "",
                phone = "",
                email = "",
                username = "",
                accessToken = null,
                isAuthenticated = false,
                isLoggingIn = false,
                isChangingPassword = false,
                passwordChangeMessage = null,
                passwordChangeError = false,
                passwordChangeSucceeded = false,
                callLogConsentAccepted = false,
                callLogPermissionGranted = false,
                callRecords = emptyList(),
                isLoadingCallHistory = false,
                callHistoryError = null,
                isSyncing = false,
                loginError = null,
                syncMessage = null,
                syncError = false,
                pendingRecords = 0,
                successfulRecords = 0,
                failedRecords = 0,
                searchQuery = "",
                filter = CallFilter.ALL
            )
        }
    }

    private fun registerDeviceForManagementSync(accessToken: String) {
        if (FirebaseApp.getApps(getApplication()).isEmpty()) {
            _uiState.update {
                it.copy(
                    syncMessage = "This app is not connected to Firebase push yet.",
                    syncError = true
                )
            }
            return
        }

        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                if (_uiState.value.username.isBlank()) return@addOnSuccessListener
                callLogRepository.saveFcmToken(token)
                viewModelScope.launch {
                    try {
                        ApiService.registerDevice(
                            deviceId = callLogRepository.deviceId(),
                            fcmToken = token,
                            accessToken = accessToken
                        )
                        _uiState.update {
                            it.copy(
                                syncMessage = "This phone is ready for management-initiated sync.",
                                syncError = false
                            )
                        }
                    } catch (error: IOException) {
                        _uiState.update {
                            it.copy(
                                syncMessage = error.message
                                    ?: "Could not register this phone for management sync.",
                                syncError = true
                            )
                        }
                    }
                }
            }
            .addOnFailureListener { error ->
                _uiState.update {
                    it.copy(
                        syncMessage = error.message
                            ?: "Could not get a Firebase push token.",
                        syncError = true
                    )
                }
            }
    }
}
