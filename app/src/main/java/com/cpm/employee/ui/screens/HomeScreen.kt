package com.cpm.employee.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.cpm.employee.EmployeeUiState
import com.cpm.employee.data.CallRecord
import com.cpm.employee.data.CallType
import com.cpm.employee.navigation.EmployeeRoutes
import com.cpm.employee.ui.components.Avatar
import com.cpm.employee.ui.components.EmployeeScaffold
import com.cpm.employee.ui.components.IconBadge
import com.cpm.employee.ui.components.SectionTitle
import com.cpm.employee.ui.components.SettingsAction
import com.cpm.employee.ui.components.SurfaceCard
import com.cpm.employee.ui.theme.BrandCyan
import com.cpm.employee.ui.theme.BrandNavy
import com.cpm.employee.ui.theme.Error
import com.cpm.employee.ui.theme.PaleBlue
import com.cpm.employee.ui.theme.Success
import com.cpm.employee.ui.theme.TextPrimary
import com.cpm.employee.ui.theme.TextSecondary
import com.cpm.employee.ui.theme.Warning
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun HomeScreen(
    employee: EmployeeUiState,
    navController: NavHostController,
    onNavigate: (String) -> Unit
) {
    HomeContent(employee, navController, onNavigate)
}

@Composable
private fun HomeContent(
    employee: EmployeeUiState,
    navController: NavHostController,
    onNavigate: (String) -> Unit
) {
    val today = LocalDate.now()
    val todayCalls = employee.callRecords.filter { call ->
        Instant.ofEpochMilli(call.dateTimeMillis)
            .atZone(ZoneId.systemDefault())
            .toLocalDate() == today
    }
    val todayLabel = today.format(DateTimeFormatter.ofPattern("d MMM", Locale.getDefault()))
    val incomingCalls = todayCalls.count { it.type == CallType.INCOMING }
    val outgoingCalls = todayCalls.count { it.type == CallType.OUTGOING }
    val missedCalls = todayCalls.count {
        it.status == "missed" || it.type == CallType.MISSED || it.type == CallType.REJECTED
    }
    val talkSeconds = todayCalls.filter { it.status == "answered" }.sumOf { it.durationSeconds }

    EmployeeScaffold(
        title = "Dashboard",
        navController = navController,
        selectedRoute = EmployeeRoutes.HOME,
        actions = { SettingsAction { onNavigate(EmployeeRoutes.SETTINGS) } }
    ) { padding ->
        LazyColumn(
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
            modifier = Modifier.padding(padding)
        ) {
            item {
                SurfaceCard {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Avatar(
                            employee.employeeName.split(" ").mapNotNull { it.firstOrNull() }
                                .take(2).joinToString("").ifBlank { "EM" },
                            size = 56
                        )
                        Column(modifier = Modifier.weight(1f).padding(start = 14.dp)) {
                            Text("Good morning,", color = TextSecondary, style = MaterialTheme.typography.bodyMedium)
                            Text(
                                employee.employeeName,
                                color = TextPrimary,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            Text("${employee.employeeId} · ${employee.role}", color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SectionTitle("Today's activity", modifier = Modifier.weight(1f))
                    Text(todayLabel, color = TextSecondary, style = MaterialTheme.typography.labelMedium)
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard("Total calls", todayCalls.size.toString(), Icons.Default.Call, BrandNavy, Modifier.weight(1f))
                        StatCard("Incoming", incomingCalls.toString(), Icons.Default.Call, BrandCyan, Modifier.weight(1f))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatCard("Outgoing", outgoingCalls.toString(), Icons.Default.Call, Success, Modifier.weight(1f))
                        StatCard("Missed", missedCalls.toString(), Icons.Default.Call, Error, Modifier.weight(1f))
                    }
                }
            }
            item {
                SurfaceCard {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconBadge(Icons.Default.Call, BrandNavy, PaleBlue)
                        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                            Text("Talk time", color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                            Text(formatTalkTime(talkSeconds), color = TextPrimary, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        }
                        Text("Today's total", color = TextSecondary, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            item {
                SectionTitle("Quick actions")
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    QuickAction("Call history", Icons.Default.Call, Modifier.weight(1f)) {
                        onNavigate(EmployeeRoutes.CALLS)
                    }
                    QuickAction("Sync records", Icons.Default.Refresh, Modifier.weight(1f)) {
                        onNavigate(EmployeeRoutes.SYNC)
                    }
                    QuickAction("Settings", Icons.Default.Settings, Modifier.weight(1f)) {
                        onNavigate(EmployeeRoutes.SETTINGS)
                    }
                }
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SectionTitle("Recent calls", modifier = Modifier.weight(1f))
                    Text(
                        "See all",
                        color = BrandNavy,
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.clickableRoute { onNavigate(EmployeeRoutes.CALLS) }
                    )
                }
            }
            if (employee.callRecords.isEmpty()) {
                item {
                    com.cpm.employee.ui.components.EmptyState(
                        title = "No call activity available",
                        message = when {
                            !employee.callLogConsentAccepted ->
                                "Review the call-log notice in Settings to view your activity."
                            !employee.callLogPermissionGranted ->
                                "Allow call-log access in Settings to view your activity."
                            employee.callHistoryError != null -> employee.callHistoryError
                            else -> "New call activity will appear here."
                        }
                    )
                }
            } else {
                items(employee.callRecords.take(3), key = { it.id }) { call ->
                    RecentCallRow(call) { onNavigate(EmployeeRoutes.callDetails(call.id)) }
                }
            }
        }
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: Color,
    modifier: Modifier = Modifier
) {
    SurfaceCard(modifier = modifier) {
        Column(modifier = Modifier.padding(14.dp)) {
            IconBadge(icon, tint, tint.copy(alpha = 0.1f), size = 38)
            Spacer(Modifier.height(10.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = TextPrimary)
            Text(label, color = TextSecondary, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun QuickAction(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    SurfaceCard(modifier = modifier.clickableRoute(onClick)) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            IconBadge(icon, BrandNavy, PaleBlue, size = 38)
            Spacer(Modifier.height(8.dp))
            Text(label, color = TextPrimary, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
    }
}

@Composable
private fun RecentCallRow(call: CallRecord, onClick: () -> Unit) {
    SurfaceCard(modifier = Modifier.clickableRoute(onClick)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val typeColor = when (call.type) {
                CallType.INCOMING -> BrandCyan
                CallType.OUTGOING -> Success
                CallType.MISSED -> Error
                CallType.REJECTED -> Error
            }
            IconBadge(
                icon = when (call.type) {
                    CallType.INCOMING -> Icons.Default.Call
                    CallType.OUTGOING -> Icons.Default.Call
                    CallType.MISSED -> Icons.Default.Call
                    CallType.REJECTED -> Icons.Default.Call
                },
                tint = typeColor,
                background = typeColor.copy(alpha = 0.1f),
                size = 40
            )
            Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                Text(call.phone, color = TextPrimary, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text("${call.type.label} · ${call.time}", color = TextSecondary, style = MaterialTheme.typography.bodySmall)
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "View call")
        }
    }
}

private fun Modifier.clickableRoute(onClick: () -> Unit): Modifier =
    this.clickable(onClick = onClick)

private fun formatTalkTime(totalSeconds: Int): String {
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    return if (hours > 0) "$hours hr $minutes min" else "$minutes min"
}
