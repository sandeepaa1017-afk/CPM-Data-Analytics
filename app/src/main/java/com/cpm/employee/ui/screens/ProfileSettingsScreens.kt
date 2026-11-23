package com.cpm.employee.ui.screens

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavHostController
import com.cpm.employee.EmployeeUiState
import com.cpm.employee.navigation.EmployeeRoutes
import com.cpm.employee.ui.components.Avatar
import com.cpm.employee.ui.components.EmployeeScaffold
import com.cpm.employee.ui.components.IconBadge
import com.cpm.employee.ui.components.LabelValueRow
import com.cpm.employee.ui.components.SectionTitle
import com.cpm.employee.ui.components.SurfaceCard
import com.cpm.employee.ui.theme.BrandCyan
import com.cpm.employee.ui.theme.BrandNavy
import com.cpm.employee.ui.theme.Error
import com.cpm.employee.ui.theme.PaleBlue
import com.cpm.employee.ui.theme.TextPrimary
import com.cpm.employee.ui.theme.TextSecondary

@Composable
fun ProfileScreen(employee: EmployeeUiState, navController: NavHostController) {
    EmployeeScaffold(
        title = "My profile",
        navController = navController,
        selectedRoute = EmployeeRoutes.PROFILE,
        actions = {
            androidx.compose.material3.IconButton(onClick = { navController.navigate(EmployeeRoutes.SETTINGS) }) {
                androidx.compose.material3.Icon(Icons.Default.Settings, contentDescription = "Settings")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                SurfaceCard {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(22.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Avatar("MS", size = 76)
                        Spacer(Modifier.height(12.dp))
                        Text(employee.employeeName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(employee.role, modifier = Modifier.padding(top = 4.dp), color = TextSecondary)
                        Text(
                            employee.employeeId,
                            modifier = Modifier.padding(top = 12.dp),
                            color = BrandNavy,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
            item {
                SectionTitle("Employee information")
                SurfaceCard {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                        LabelValueRow("Employee ID", employee.employeeId)
                        LabelValueRow("Role", employee.role)
                        LabelValueRow("Branch", employee.branch)
                        LabelValueRow("Phone", employee.phone)
                        LabelValueRow("Email", employee.email)
                    }
                }
            }
            item {
                SurfaceCard {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconBadge(Icons.Default.Lock, BrandNavy, PaleBlue, size = 38)
                        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                            Text("Account security", fontWeight = FontWeight.SemiBold)
                            Text("Signed in as ${employee.username}.", color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(
    state: EmployeeUiState,
    onNotificationsChanged: (Boolean) -> Unit,
    onCallSummaryChanged: (Boolean) -> Unit,
    onAutoSyncChanged: (Boolean) -> Unit,
    onCallLogConsentChanged: (Boolean) -> Unit,
    onCallLogPermissionChanged: (Boolean) -> Unit,
    onRefreshCallLogPermission: () -> Unit,
    onChangePassword: (String, String) -> Unit,
    onClearPasswordChangeStatus: () -> Unit,
    onLogout: () -> Unit,
    navController: NavHostController
) {
    var showCallLogNotice by androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf(false)
    }
    var showPasswordDialog by androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf(false)
    }
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        onCallLogPermissionChanged(granted)
    }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) onRefreshCallLogPermission()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    EmployeeScaffold(
        title = "Settings",
        navController = navController,
        selectedRoute = null,
        showBottomBar = false,
        onBack = { navController.popBackStack() }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                SectionTitle("Account security")
                SurfaceCard {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Text("Change your employee account password.", color = TextSecondary)
                        Button(
                            onClick = {
                                onClearPasswordChangeStatus()
                                showPasswordDialog = true
                            },
                            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
                        ) {
                            Text("Change password")
                        }
                    }
                }
            }
            item {
                SectionTitle("Preferences")
                SurfaceCard {
                    Column(modifier = Modifier.padding(vertical = 5.dp)) {
                        SettingsToggleRow(
                            icon = Icons.Default.Notifications,
                            title = "Notifications",
                            subtitle = "Receive app reminders and updates",
                            checked = state.notificationsEnabled,
                            onCheckedChange = onNotificationsChanged
                        )
                        SettingsToggleRow(
                            icon = Icons.Default.Call,
                            title = "Daily call summary",
                            subtitle = "Show your activity recap",
                            checked = state.callSummaryEnabled,
                            onCheckedChange = onCallSummaryChanged
                        )
                        SettingsToggleRow(
                            icon = Icons.Default.Refresh,
                            title = "Management-controlled sync",
                            subtitle = "Managers start sync when your phone is online",
                            checked = state.autoSyncEnabled,
                            onCheckedChange = onAutoSyncChanged,
                            enabled = false
                        )
                    }
                }
            }
            item {
                SectionTitle("Permissions")
                SurfaceCard {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBadge(Icons.Default.Info, BrandCyan, PaleBlue, size = 38)
                            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                                Text("Call-log sync", fontWeight = FontWeight.SemiBold)
                                Text(
                                    when {
                                        !state.callLogConsentAccepted -> "Off · your opt-in is required"
                                        state.callLogPermissionGranted -> "On · call-log permission granted"
                                        else -> "On · Android permission is required"
                                    },
                                    modifier = Modifier.padding(top = 4.dp),
                                    color = TextSecondary,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                        Text(
                            "Only records created after you opt in are eligible. No call audio or contact names are collected.",
                            modifier = Modifier.padding(top = 12.dp),
                            color = TextSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                        if (!state.callLogConsentAccepted) {
                            Button(
                                onClick = { showCallLogNotice = true },
                                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
                            ) {
                                Text("Review call-log notice")
                            }
                        } else if (!state.callLogPermissionGranted) {
                            Button(
                                onClick = {
                                    permissionLauncher.launch(Manifest.permission.READ_CALL_LOG)
                                },
                                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
                            ) {
                                Text("Grant Android permission")
                            }
                            TextButton(
                                onClick = {
                                    context.startActivity(
                                        Intent(
                                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                            Uri.fromParts("package", context.packageName, null)
                                        )
                                    )
                                },
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("Open app permission settings")
                            }
                            TextButton(
                                onClick = { onCallLogConsentChanged(false) },
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("Turn off call-log sync", color = Error)
                            }
                        } else {
                            TextButton(
                                onClick = { onCallLogConsentChanged(false) },
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("Turn off call-log sync", color = Error)
                            }
                        }
                    }
                }
            }
            item {
                SurfaceCard {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("App information", fontWeight = FontWeight.SemiBold)
                        Text("CPM Employee · Version 1.0", modifier = Modifier.padding(top = 6.dp), color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                        Text("Call history shows device records created after you opt in.", modifier = Modifier.padding(top = 3.dp), color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            item {
                Button(
                    onClick = onLogout,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(13.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = Error
                    )
                ) {
                    androidx.compose.material3.Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                    Text("Sign out", fontWeight = FontWeight.SemiBold)
                }
                Text(
                    "Sign in again with your CPM employee account.",
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                    color = TextSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        if (showCallLogNotice) {
            AlertDialog(
                onDismissRequest = { showCallLogNotice = false },
                title = { Text("Call-log data and consent") },
                text = {
                    Text(
                        "If you agree and grant Android permission, CPM Employee will upload call phone numbers, " +
                            "call direction/type, date/time, and duration to the CPM company backend. CPM managers " +
                            "and administrators can view synced records for work reporting. Calls are not recorded; " +
                            "audio and contact names are not collected. Calls dated before you opt in are not uploaded. " +
                            "Turning sync off stops future uploads but does not delete records already sent. " +
                            "You can revoke permission at any time."
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showCallLogNotice = false
                            onCallLogConsentChanged(true)
                            permissionLauncher.launch(Manifest.permission.READ_CALL_LOG)
                        }
                    ) {
                        Text("Agree & continue")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCallLogNotice = false }) {
                        Text("Not now")
                    }
                }
            )
        }
        if (showPasswordDialog) {
            ChangePasswordDialog(
                state = state,
                onChangePassword = onChangePassword,
                onDismiss = { showPasswordDialog = false }
            )
        }
    }
}

@Composable
private fun ChangePasswordDialog(
    state: EmployeeUiState,
    onChangePassword: (String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var currentPassword by androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf("")
    }
    var newPassword by androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf("")
    }
    var confirmPassword by androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf("")
    }
    var validationError by androidx.compose.runtime.remember {
        androidx.compose.runtime.mutableStateOf<String?>(null)
    }
    androidx.compose.runtime.LaunchedEffect(state.passwordChangeSucceeded) {
        if (state.passwordChangeSucceeded) {
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
            validationError = null
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = currentPassword,
                    onValueChange = {
                        currentPassword = it
                        validationError = null
                    },
                    label = { Text("Current password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = {
                        newPassword = it
                        validationError = null
                    },
                    label = { Text("New password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = {
                        confirmPassword = it
                        validationError = null
                    },
                    label = { Text("Confirm new password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
                val message = validationError ?: state.passwordChangeMessage
                if (message != null) {
                    Text(
                        message,
                        color = if (validationError != null || state.passwordChangeError) {
                            Error
                        } else {
                            BrandNavy
                        },
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Text(
                    "Use at least 8 characters and no more than 72 UTF-8 bytes.",
                    color = TextSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = !state.isChangingPassword && !state.passwordChangeSucceeded,
                onClick = {
                    validationError = when {
                        currentPassword.isBlank() -> "Enter your current password."
                        newPassword.length < 8 -> "New password must be at least 8 characters."
                        newPassword.toByteArray(Charsets.UTF_8).size > 72 ->
                            "New password must not exceed 72 UTF-8 bytes."
                        newPassword != confirmPassword -> "New passwords do not match."
                        newPassword == currentPassword ->
                            "New password must differ from the current password."
                        else -> null
                    }
                    if (validationError == null) {
                        onChangePassword(currentPassword, newPassword)
                    }
                }
            ) {
                Text(if (state.isChangingPassword) "Saving…" else "Update")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(if (state.passwordChangeSucceeded) "Done" else "Cancel")
            }
        }
    )
}

@Composable
private fun SettingsToggleRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBadge(icon, BrandNavy, PaleBlue, size = 38)
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp, end = 6.dp)) {
            Text(title, color = TextPrimary, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(subtitle, color = TextSecondary, style = MaterialTheme.typography.bodySmall)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled
        )
    }
}
